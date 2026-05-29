import { useState, useEffect } from 'react';
import { getSeedData } from '../data/seedData';
import { getSeedDataGlobal } from '../data/seedDataGlobal';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const PROJECTS = [
  { id: 'repeach', name: '리피치 비즈니스 파이프라인 구축' },
  { id: 'global_med', name: '글로벌 의약대 파운데이션 론칭' }
];

const getSeedFor = (projectId) =>
  projectId === 'global_med' ? getSeedDataGlobal() : getSeedData();

export const useTodoDB = (projectId) => {
  const [todos, setTodos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ---------- 로드 ----------
  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);

    const load = async () => {
      if (isSupabaseConfigured) {
        try {
          const [{ data: cats, error: catErr }, { data: tds, error: todoErr }] = await Promise.all([
            supabase.from('categories').select('*').eq('project_id', projectId).order('position'),
            supabase.from('todos').select('*').eq('project_id', projectId).order('position'),
          ]);
          if (catErr) throw catErr;
          if (todoErr) throw todoErr;

          if (cancelled) return;

          if (cats && cats.length > 0) {
            // DB에 이미 데이터가 있으면 그대로 사용
            setCategories(cats.map(c => ({ id: c.id, name: c.name })));
            setTodos((tds || []).map(t => ({
              id: t.id,
              categoryId: t.category_id,
              title: t.title || '',
              completed: !!t.completed,
              notes: t.notes || '',
              assignee: t.assignee || '',
              progress: t.progress || '0',
            })));
          } else {
            // DB가 비어 있으면 시드 데이터를 채워넣고 사용 (최초 1회)
            const seed = getSeedFor(projectId);
            await pushToSupabase(projectId, seed.categories, seed.todos);
            if (cancelled) return;
            setCategories(seed.categories);
            setTodos(seed.todos);
          }
        } catch (err) {
          console.error('Supabase 로드 실패, 시드 데이터로 표시합니다:', err);
          if (cancelled) return;
          const seed = getSeedFor(projectId);
          setCategories(seed.categories);
          setTodos(seed.todos);
          alert('⚠️ DB(Supabase) 연결에 실패했습니다. 화면에는 기본 데이터가 표시되지만 저장되지 않습니다.\n\n' + (err.message || err));
        }
      } else {
        // ---- localStorage 폴백 모드 (Supabase 미설정 시) ----
        const todosKey = `businessTodos_${projectId}`;
        const catKey = `businessCategories_${projectId}`;
        const storedTodos = localStorage.getItem(todosKey);
        const storedCategories = localStorage.getItem(catKey);

        if (storedTodos && storedCategories) {
          setTodos(JSON.parse(storedTodos));
          setCategories(JSON.parse(storedCategories));
        } else if (projectId === 'repeach' && localStorage.getItem('businessTodos')) {
          const legacyTodos = localStorage.getItem('businessTodos');
          const legacyCats = localStorage.getItem('businessCategories');
          setTodos(JSON.parse(legacyTodos));
          setCategories(JSON.parse(legacyCats));
          localStorage.setItem(todosKey, legacyTodos);
          localStorage.setItem(catKey, legacyCats);
        } else {
          const seed = getSeedFor(projectId);
          setTodos(seed.todos);
          setCategories(seed.categories);
          localStorage.setItem(todosKey, JSON.stringify(seed.todos));
          localStorage.setItem(catKey, JSON.stringify(seed.categories));
        }
      }

      if (!cancelled) {
        setHasUnsavedChanges(false);
        setIsLoaded(true);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // ---------- Supabase 저장 헬퍼 ----------
  const pushToSupabase = async (pid, cats, tds) => {
    // 프로젝트 메타 보장
    const projectName = PROJECTS.find(p => p.id === pid)?.name || pid;
    await supabase.from('projects').upsert({ id: pid, name: projectName });

    // 카테고리 업서트 후, 현재 목록에 없는 카테고리 삭제
    const catRows = cats.map((c, i) => ({ project_id: pid, id: String(c.id), name: c.name, position: i }));
    if (catRows.length) {
      const { error } = await supabase.from('categories').upsert(catRows);
      if (error) throw error;
    }
    await supabase.from('categories').delete().eq('project_id', pid)
      .not('id', 'in', `(${cats.map(c => `"${String(c.id)}"`).join(',') || '""'})`);

    // 할 일 업서트 후, 현재 목록에 없는 할 일 삭제
    const todoRows = tds.map((t, i) => ({
      project_id: pid,
      id: String(t.id),
      category_id: String(t.categoryId),
      title: t.title || '',
      completed: !!t.completed,
      notes: t.notes || '',
      assignee: t.assignee || '',
      progress: t.progress || '0',
      position: i,
    }));
    if (todoRows.length) {
      const { error } = await supabase.from('todos').upsert(todoRows);
      if (error) throw error;
    }
    await supabase.from('todos').delete().eq('project_id', pid)
      .not('id', 'in', `(${tds.map(t => `"${String(t.id)}"`).join(',') || '""'})`);
  };

  // ---------- 저장 ----------
  const saveToDB = async () => {
    if (isSupabaseConfigured) {
      setIsSaving(true);
      try {
        await pushToSupabase(projectId, categories, todos);
        setHasUnsavedChanges(false);
        alert('✅ 변경사항이 클라우드 DB(Supabase)에 저장되었습니다!');
      } catch (err) {
        console.error('Supabase 저장 실패:', err);
        alert('❌ 저장에 실패했습니다.\n\n' + (err.message || err));
      } finally {
        setIsSaving(false);
      }
    } else {
      localStorage.setItem(`businessTodos_${projectId}`, JSON.stringify(todos));
      localStorage.setItem(`businessCategories_${projectId}`, JSON.stringify(categories));
      setHasUnsavedChanges(false);
      alert('✅ 변경사항이 이 브라우저에 저장되었습니다. (Supabase 미설정 — 다른 기기와는 공유되지 않습니다)');
    }
  };

  const updateTodo = (id, updates) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    setHasUnsavedChanges(true);
  };

  const deleteTodo = (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    setHasUnsavedChanges(true);
  };

  const addTodo = (categoryId, title) => {
    setTodos(prev => [...prev, {
      id: uuidv4(),
      categoryId: categoryId || categories[0].id,
      title: title || '새로운 할 일',
      completed: false,
      notes: '',
      assignee: '',
      progress: '0'
    }]);
    setHasUnsavedChanges(true);
  };

  return {
    categories, todos, isLoaded, isSaving,
    updateTodo, deleteTodo, addTodo, saveToDB, hasUnsavedChanges,
    isSupabaseConfigured,
  };
};
