# 비즈니스 To-Do 관리 대시보드

리피치 비즈니스 구축 / 글로벌 의약대 론칭 프로젝트의 할 일을
**테이블 뷰 · 마인드맵 뷰**로 관리하는 웹앱입니다.
데이터는 **Supabase(클라우드 DB)** 에 저장되어 어느 기기에서나 같은 내용을 보고 체크할 수 있습니다.

## 기능
- ✅ 할 일 체크 / 진행률(0~100%) / 담당자 / 메모 관리
- 📂 16개 카테고리(모듈)별 정리, 프로젝트 전환
- ➕ 할 일 추가 / 수정 / 삭제
- 🗺️ 마인드맵 뷰 + 테이블 뷰
- ☁️ Supabase 클라우드 저장 (미설정 시 자동으로 브라우저 로컬 저장으로 동작)

---

## 처음 설정하기 (Supabase 연결)

### 1. Supabase 프로젝트 만들기
1. https://supabase.com 접속 → 로그인 (GitHub 계정으로 가능)
2. **New project** 클릭 → 이름/비밀번호/리전(예: Northeast Asia - Seoul) 입력 후 생성
3. 1~2분 기다리면 프로젝트 준비 완료

### 2. 테이블 만들기
1. 좌측 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 [`supabase/schema.sql`](supabase/schema.sql) 내용을 전부 복사해 붙여넣기
3. **Run** 클릭 (테이블 3개 생성됨)

### 3. 연결 키 넣기
1. 좌측 **Project Settings → API** 이동
2. **Project URL** 과 **anon public** 키 복사
3. 프로젝트 폴더에서 `.env.example` 을 복사해 `.env` 파일을 만들고 값 입력:
   ```env
   VITE_SUPABASE_URL=https://여기에_프로젝트_URL.supabase.co
   VITE_SUPABASE_ANON_KEY=여기에_anon_public_키
   ```

### 4. 실행
```bash
npm install
npm run dev
```
브라우저에서 열고, 우측 상단에 **"● 클라우드 DB 연결됨"** 이 보이면 성공입니다.
최초 실행 시 기본 할 일 목록이 자동으로 DB에 채워집니다.

> 변경 후에는 우측 상단 **"DB에 변경사항 저장"** 버튼을 눌러야 클라우드에 반영됩니다.

---

## 참고
- `.env` 파일은 **절대 GitHub에 올라가지 않습니다** (`.gitignore` 처리됨).
- 현재는 로그인 없이 누구나 수정 가능한 MVP 설정입니다.
  외부에 널리 공유하기 전 **Supabase Auth(로그인)** 추가를 권장합니다.
