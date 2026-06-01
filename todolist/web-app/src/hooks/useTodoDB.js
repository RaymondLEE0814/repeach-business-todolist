import { useState, useEffect, useCallback } from 'react';
import { getSeedData } from '../data/seedData';
import { getSeedDataGlobal } from '../data/seedDataGlobal';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

// 최초 1회 자동 시드되는 기본 프로젝트 (DB가 비어 있을 때만 사용)
export const BOOTSTRAP_PROJECTS = [
  { id: 'repeach', name: '리피치 비즈니스 파이프라인 구축' },
  { id: 'global_med', name: '글로벌 의약대 파운데이션 론칭' }
];
// 하위 호환용
export const PROJECTS = BOOTSTRAP_PROJECTS;

const getSeedFor = (projectId) => {
  if (projectId === 'global_med') return getSeedDataGlobal();
  if (projectId === 'repeach') return getSeedData();
  return { categories: [], todos: [] }; // 사용자가 새로 만든 프로젝트는 빈 상태로 시작
};

// =====================================================================
// 프로젝트 목록 관리 훅 — 목록을 DB에서 읽어오므로 코드 수정 없이 확장 가능
// =====================================================================
export const useProjects = () => {
  const [projects, setProjects] = useState([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setProjects(BOOTSTRAP_PROJECTS);
      setProjectsLoaded(true);
      return BOOTSTRAP_PROJECTS;
    }
    try {
      let { data, error } = await supabase.from('projects').select('*').order('created_at');
      if (error) throw error;
      // DB가 완전히 비어 있으면 기본 프로젝트 2개를 부트스트랩
      if (!data || data.length === 0) {
        await supabase.from('projects').upsert(BOOTSTRAP_PROJECTS.map(p => ({ id: p.id, name: p.name })));
        ({ data } = await supabase.from('projects').select('*').order('created_at'));
      }
      const list = (data || []).map(p => ({ id: p.id, name: p.name }));
      setProjects(list);
      setProjectsLoaded(true);
      return list;
    } catch (err) {
      console.error('프로젝트 목록 로드 실패:', err);
      setProjects(BOOTSTRAP_PROJECTS);
      setProjectsLoaded(true);
      return BOOTSTRAP_PROJECTS;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createProject = async (name) => {
    const id = uuidv4();
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('projects').insert({ id, name });
      if (error) { alert('프로젝트 생성 실패: ' + (error.message || error)); return null; }
    }
    await refresh();
    return id;
  };

  return { projects, projectsLoaded, createProject, refreshProjects: refresh };
};

// =====================================================================
// 단일 프로젝트의 카테고리/할 일 관리 훅
// =====================================================================
export const useTodoDB = (projectId) => {
  const [todos, setTodos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ---------- 로드 ----------
  useEffect(() => {
    if (!projectId) return;
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
            setCategories(cats.map(c => ({ id: c.id, name: c.name })));
            setTodos((tds || []).map(mapRowToTodo));
          } else {
            // DB가 비어 있으면 시드(기본 프로젝트만) 채워넣기, 사용자 프로젝트는 빈 상태
            const seed = getSeedFor(projectId);
            if (seed.categories.length > 0) {
              await pushToSupabase(projectId, seed.categories, seed.todos);
            }
            if (cancelled) return;
            setCategories(seed.categories);
            setTodos(seed.todos);
          }
        } catch (err) {
          console.error('Supabase 로드 실패:', err);
          if (cancelled) return;
          const seed = getSeedFor(projectId);
          setCategories(seed.categories);
          setTodos(seed.todos);
          alert('⚠️ DB(Supabase) 로드에 실패했습니다.\n\n' + (err.message || err));
        }
      } else {
        // ---- localStorage 폴백 모드 ----
        const todosKey = `businessTodos_${projectId}`;
        const catKey = `businessCategories_${projectId}`;
        const storedTodos = localStorage.getItem(todosKey);
        const storedCategories = localStorage.getItem(catKey);
        if (storedTodos && storedCategories) {
          setTodos(JSON.parse(storedTodos));
          setCategories(JSON.parse(storedCategories));
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
    const catRows = cats.map((c, i) => ({ project_id: pid, id: String(c.id), name: c.name, position: i }));
    if (catRows.length) {
      const { error } = await supabase.from('categories').upsert(catRows);
      if (error) throw error;
    }

    const todoRows = tds.map((t, i) => ({
      project_id: pid,
      id: String(t.id),
      category_id: String(t.categoryId),
      title: t.title || '',
      completed: !!t.completed,
      notes: t.notes || '',
      assignee: t.assignee || '',
      progress: t.progress || '0',
      link: t.link || '',
      position: i,
    }));
    if (todoRows.length) {
      let { error } = await supabase.from('todos').upsert(todoRows);
      // link 컬럼이 아직 추가되지 않은 DB에서도 동작하도록 폴백
      if (error && /link/i.test(error.message || '') && /column|schema/i.test(error.message || '')) {
        const stripped = todoRows.map(({ link, ...r }) => r);
        ({ error } = await supabase.from('todos').upsert(stripped));
      }
      if (error) throw error;
    }

    await deleteRemovedRows('categories', pid, new Set(catRows.map(r => r.id)));
    await deleteRemovedRows('todos', pid, new Set(todoRows.map(r => r.id)));
  };

  const deleteRemovedRows = async (table, pid, keepIds) => {
    const { data: existing, error } = await supabase.from(table).select('id').eq('project_id', pid);
    if (error) throw error;
    const toDelete = (existing || []).map(r => r.id).filter(id => !keepIds.has(id));
    if (toDelete.length) {
      const { error: delErr } = await supabase.from(table).delete().eq('project_id', pid).in('id', toDelete);
      if (delErr) throw delErr;
    }
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
      alert('✅ 변경사항이 이 브라우저에 저장되었습니다. (Supabase 미설정)');
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
    const cid = categoryId || (categories[0] && categories[0].id);
    if (!cid) { alert('먼저 카테고리를 추가해주세요.'); return; }
    setTodos(prev => [...prev, {
      id: uuidv4(),
      categoryId: cid,
      title: title || '새로운 할 일',
      completed: false,
      notes: '',
      assignee: '',
      progress: '0',
      link: '',
    }]);
    setHasUnsavedChanges(true);
  };

  const addCategory = (name) => {
    const newCat = { id: uuidv4(), name: name || '새 카테고리' };
    setCategories(prev => [...prev, newCat]);
    setHasUnsavedChanges(true);
    return newCat.id;
  };

  const deleteCategory = (id) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setTodos(prev => prev.filter(t => t.categoryId !== id));
    setHasUnsavedChanges(true);
  };

  return {
    categories, todos, isLoaded, isSaving,
    updateTodo, deleteTodo, addTodo, addCategory, deleteCategory, saveToDB,
    hasUnsavedChanges, isSupabaseConfigured,
  };
};

function mapRowToTodo(t) {
  return {
    id: t.id,
    categoryId: t.category_id,
    title: t.title || '',
    completed: !!t.completed,
    notes: t.notes || '',
    assignee: t.assignee || '',
    progress: t.progress || '0',
    link: t.link || '',
  };
}
