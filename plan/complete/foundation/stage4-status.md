# Stage 4: Frontend Shell & Auth Pages - COMPLETED

## 완료 항목

### 1. 의존성 설치
- Tailwind CSS, Radix UI (8 packages), zustand, react-query, axios
- react-hook-form + zod, lucide-react, sonner

### 2. Tailwind + 테마
- PostCSS 설정, CSS 커스텀 프로퍼티 (light/dark)
- globals.css with HSL color system

### 3. Lib 레이어
- `api/client.ts`: Axios + auth interceptor (401 자동 refresh)
- `api/auth.ts`: Auth API 함수들 (register, login, etc.)
- `stores/auth-store.ts`: Zustand auth state
- `stores/theme-store.ts`: Zustand theme state
- `utils/cn.ts`: clsx + tailwind-merge
- `providers.tsx`: QueryClientProvider + Toaster

### 4. Root Layout + Middleware
- Root layout: fonts, providers 래핑
- `middleware.ts`: 인증 라우트 가드 (refreshToken 쿠키 확인)

### 5. UI 컴포넌트
- Button (7 variants, 4 sizes, asChild)
- Input, Label (Radix), Card/CardHeader/CardTitle/CardDescription/CardContent

### 6. Auth 페이지 (6개)
- Login: react-hook-form + zod, OAuth 버튼, remember me
- Register: password strength bar, terms checkbox
- Forgot Password: 이메일 입력 → 성공 메시지
- Reset Password: searchParams (await) → 새 비밀번호
- Verify Email: searchParams (await) → 자동 인증
- OAuth Callback: searchParams (await) → 리다이렉트/에러

### 7. Main Layout + Sidebar
- (main)/layout.tsx: 사이드바 + 메인 컨텐츠 영역
- Sidebar: 7개 메뉴 (lucide-react 아이콘), 활성 상태 하이라이트, 축소 모드
- 사용자 영역 (아바타 + 이름)

### 8. Placeholder 페이지 (8개)
- dashboard, workflows, triggers, schedules, integrations, authentication, statistics, profile

### 9. 검증
- Build: SUCCESS (15 routes, 3 dynamic)
- Lint: 0 errors, 0 warnings
- Next.js 16 호환: searchParams await, Server Components

## 다음: Stage 5 - Expression Engine
