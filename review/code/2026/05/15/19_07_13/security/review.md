# 보안(Security) 코드 리뷰

**리뷰 대상**: brand-refresh-7a3f12 — 브랜드 비주얼 아이덴티티 리프레시
**리뷰 일시**: 2026-05-15
**분석 파일 수**: 21개 (README.md, frontend TSX/CSS, plan/review 문서 포함)

---

## 발견사항

- **[INFO]** SVG 정적 자산을 `<img>` 태그로 직접 렌더링 — XSS 위험 없음, 단 CSP 정책 확인 권장
  - 위치: `frontend/src/components/ui/logo.tsx` 전체 (신규 파일)
  - 상세: `logo.tsx` 는 `eslint-disable @next/next/no-img-element` 주석을 달고 `<img src={src} ...>` 로 정적 SVG 경로(`/logo.svg`, `/logo-dark.svg` 등)를 렌더링한다. `src` 값은 컴포넌트 내부의 `ASSET_PATHS` 상수에서만 오며 사용자 입력이 개입하지 않는다. 또한 `alt` 와 `className` 은 부모가 전달하는 props 이지만 이들이 HTML 속성으로 직접 주입될 뿐 script 실행 경로는 없다. 정적 경로이므로 경로 탐색(path traversal) 위험도 없다. 그러나 Next.js 앱의 Content-Security-Policy(CSP) 헤더에 `img-src 'self'` 가 설정되어 있지 않다면 향후 동적 src 추가 시 XSS 확장 위험이 잠재한다.
  - 제안: Next.js `next.config` 또는 미들웨어에서 `Content-Security-Policy: img-src 'self'` 를 명시해 이미지 소스를 origin으로 제한한다. SVG 파일 자체에 `<script>` 태그가 없는지 CI 단계에서 확인하는 린트를 추가하면 추가 방어층이 생긴다.

- **[INFO]** OG/Twitter 메타태그에 SVG 이미지 URL 사용 — 소셜 플랫폼 호환성 우려
  - 위치: `frontend/src/app/layout.tsx` — `openGraph.images[0].type: "image/svg+xml"`, `twitter.images: ["/opengraph-image.svg"]`
  - 상세: OG/Twitter 메타태그가 PNG 대신 SVG를 참조한다. 보안상 직접 취약점은 아니지만, 일부 소셜 플랫폼의 크롤러는 SVG를 허용하지 않아 이미지 미리보기 실패 시 플레이스홀더가 표시된다. 더 중요하게는, 플랫폼 크롤러가 외부 URL로 SVG를 가져갈 때 SVG 내부에 `<script>` 나 `<a>` 태그가 포함되어 있으면 보안 이슈가 될 수 있다. 현재 자산은 정적 빌드 산출물이므로 즉각적 위험은 낮다.
  - 제안: `plan/in-progress/brand-refresh-impl.md` §1.3 의 PNG 자산 생성 완료 후 OG/Twitter 이미지를 PNG로 교체한다. SVG 파일 배포 전 `<script>`, `<foreignObject>`, `<iframe>` 등 위험 요소를 포함하지 않는지 CI 검증을 추가한다.

- **[INFO]** `_retry_state.json` 에 절대 경로 하드코딩 — 경로 노출 위험
  - 위치: `review/consistency/2026/05/15/18_25_10/_retry_state.json` — `session_dir`, `prompt_file`, `output_file` 등
  - 상세: `_retry_state.json` 에 `/Volumes/project/private/clemvion/...` 형태의 로컬 절대 경로가 하드코딩되어 있다. 이 파일이 git 리포지터리에 커밋·공개되면 개발 환경의 로컬 디렉터리 구조가 노출된다. 직접적인 공격 벡터는 아니지만 공격자가 경로 정보를 사회공학적으로 활용할 수 있다. 또한 macOS `/Volumes/` 경로는 개발 환경 특정 정보다.
  - 제안: `_retry_state.json` 을 `.gitignore` 에 추가하거나, 경로를 상대 경로 또는 환경 변수 기반으로 저장하도록 orchestrator 스크립트를 수정한다. 현재 `review/` 산출물이 공개 리포지터리에 포함될 계획이라면 이 파일 타입은 반드시 제외 대상이다.

- **[INFO]** README에 SVG 로고를 상대 경로로 임베드 — GitHub 외 렌더러 호환성
  - 위치: `README.md` 라인 34-36 — `<img src="frontend/public/logo.svg" ...>`
  - 상세: README에 상대 경로로 SVG를 참조한다. GitHub은 SVG를 렌더링하되 `<script>` 등 위험 요소는 sanitize 한다. 그러나 다른 Markdown 렌더러나 npm/PyPI 패키지 페이지로 배포될 경우 sanitization 수준이 다를 수 있다. 현재 자산이 정적 PNG/SVG 이미지인 한 직접적 위험은 없다.
  - 제안: SVG 자산에 스크립트/외부 참조가 없음을 확인하는 CI 검사를 추가한다. 필요 시 PNG 폴백을 `<picture>` 태그로 제공한다.

---

## 요약

이번 brand-refresh 변경은 정적 SVG 브랜드 자산 도입, CSS 테마 토큰 재정의, Logo 컴포넌트 신규 작성으로 구성된다. 보안상 주요 위험 경로인 사용자 입력 처리, 인증/인가 로직, 데이터베이스 접근, 외부 API 호출이 전혀 포함되지 않아 CRITICAL·WARNING 등급의 취약점은 발견되지 않았다. 하드코딩된 시크릿, SQL 인젝션, XSS 직접 경로, 인증 우회 가능성은 없다. 발견된 4건은 모두 INFO 등급으로: SVG를 `<img>`로 직접 렌더링할 때의 CSP 정책 부재 가능성, OG/Twitter 메타태그의 SVG 사용으로 인한 소셜 크롤러 호환성 및 잠재적 SVG 스크립트 위험, `_retry_state.json`에 로컬 절대 경로 하드코딩으로 인한 개발 환경 정보 노출, README SVG 임베드의 렌더러 간 sanitization 차이 문제다. 이 중 `_retry_state.json` 경로 노출은 파일을 `.gitignore`에 추가하는 방식으로 즉시 해소 가능하며, 나머지는 CI 검증 추가와 PNG 자산 생성(plan §1.3 이후) 으로 대응할 수 있다.

---

## 위험도

LOW
