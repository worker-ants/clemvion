# VoiceOver 수동 검증 — Stage 10

**상태**: 🚧 검증 미수행 (사용자 수행 대기)

**대상**: macOS 기본 VoiceOver (Cmd+F5 토글). 본 단계는 axe 자동 검사가 잡지 못하는
스크린 리더 흐름·낭독·landmark 인지를 사람이 점검한다.

**검증 시점**: Stage 10 종료 직전 (Step G).

## 사전 조건

1. dev 서버 띄움: `cd frontend && npm run dev`
2. macOS VoiceOver 활성화: Cmd+F5
3. 안내 음성 속도 적정 조정 (VO+Cmd+Shift+= 로 빠르게)

## 검증 플로우 — 로그인 → 대시보드 → 워크플로우 생성

### 1. 로그인 페이지 (`/login`)

- [ ] 페이지 진입 — 페이지 제목 ("로그인" / "Sign in") announce
- [ ] Tab → 이메일 입력 — "Email, edit text" 류 announce
- [ ] 잘못된 이메일 입력 후 제출 — 에러 메시지 자동 announce (`role="alert"`)
- [ ] Tab → 비밀번호 입력 — "Password, edit text, secure"
- [ ] Tab → "비밀번호를 잊으셨나요?" 링크 — 링크임을 명시
- [ ] Tab → 로그인 버튼 — 버튼 라벨 announce
- [ ] 로그인 성공 → 대시보드 이동 시 toast announce

### 2. 대시보드 (`/dashboard`)

- [ ] 진입 시 페이지 제목 + h1 announce
- [ ] VO+U → 로터에서 landmark 목록 — `<nav>` (Main navigation) + `<main>` 둘 다
- [ ] Cmd+Option+H → 헤딩 순차 진행 (h1 → h2)
- [ ] 첫 Tab → "본문으로 건너뛰기" 링크 announce
- [ ] Skip 링크 활성화 → 포커스가 `<main>` 으로 점프

### 3. 워크플로우 생성 (`/workflows/new` 또는 dashboard 의 "New workflow")

- [ ] "New workflow" 버튼 announce
- [ ] 캔버스 진입 — toolbar Save/Run/Back 라벨 정확
- [ ] icon-only 버튼 (Back, Zoom in/out, Fit to view) 모두 aria-label announce
- [ ] 노드 추가 → 캔버스 노드 라벨/타입 announce
- [ ] Run 시 실행 상태 자동 announce (run-results-drawer `aria-live="polite"`)

### 4. SlideDrawer (트리거 detail 등)

- [ ] 트리거 행 클릭 → drawer 열림 + "dialog, [title]" announce
- [ ] Tab — 포커스가 drawer 내부 순환 (밖으로 안 새도록 Radix FocusScope trap)
- [ ] Esc → drawer 닫힘 + 트리거 행 으로 포커스 복귀

### 5. 색 대비 (수동 spot-check)

- [ ] sidebar muted 텍스트가 light/dark mode 모두 충분히 대비
- [ ] dark mode toggle 후 동일 플로우 한 번 더 — 가독성 OK

## 결과 기록

검증 일시: ___________
검증자: ___________

발견된 이슈:
- (없음 / 또는 항목별 기록)

다음 액션:
- (없음 — Stage 10 통과 / 또는 후속 fix 항목)

## 비고

자동 e2e (`frontend/e2e/a11y/smoke.spec.ts`) 가 axe 룰 위반 0 을 강제 — 색 대비,
ARIA 누락, 키보드 트랩, role 누락 등 자동 검출 가능 항목은 모두 거기서 잡힌다.
본 VoiceOver 패스는 "사람이 들었을 때 자연스러운가" 라는 자동화로 잡기 어려운
부분 (announce 타이밍, 헤딩 위계의 의미적 적절성, 동적 콘텐츠 announce 폭증)
을 검증한다.
