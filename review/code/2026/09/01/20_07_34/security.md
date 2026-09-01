# 보안(Security) 코드 리뷰

## 검토 범위

11개 파일 — 대부분 mechanical fix(`package.json` lint 스크립트 quoting, TS 타입 술어 리팩터, `switch/case` 블록 스코프 수정)와 `plan/` 문서(spec draft 이동·트러블슈팅 기록)로 구성. 애플리케이션 런타임 동작을 바꾸는 신규 기능 코드는 없다.

## 파일별 분석

### 1. `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,masked-markers,node-summary}/package.json`

`"lint": "eslint src/**/*.ts"` → `"lint": "eslint \"src/**/*.ts\""` (glob 을 셸이 아니라 eslint 자신이 해석하도록 quoting). 순수 셸 이식성(zsh nomatch 등) 수정이며 보안 영향 없음. `prepare` 스크립트의 `child_process.execSync('tsc', {stdio:'inherit'})` 는 이번 diff 로 도입된 것이 아니라 기존 코드(문맥으로만 표시)이고, 인자가 고정 문자열이라 커맨드 인젝션 표면이 아니다.

### 2. `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts`

`SUBCLASSES` 필터의 타입 술어를 명시 함수 시그니처(`new (message: string) => ExpressionError`)에서 모듈 유도 매핑 타입(`SubclassName`/`ErrorsModule[SubclassName]`)으로 바꾼 순수 타입 레벨 리팩터. 런타임 필터 로직(`typeof value === 'function' && value !== ExpressionError && value.prototype instanceof ExpressionError`)과 이후의 화이트리스트 단언(`ALLOWED_KEYS`, `err.code`, `err.position`)은 그대로다. 이 테스트는 `spec/5-system/3-error-handling.md` §6.3.1 C2("에러 객체가 message/name 밖의 민감 정보를 enumerable own property 로 노출하지 않는다")를 지키는 회귀 캐너리이며, 이번 변경은 그 보장 범위를 넓히지도 좁히지도 않는다(오히려 전수성 단언이 타입 에러로 깨지던 문제를 고쳐 캐너리를 다시 살렸다는 점에서 방어적 테스트 인프라 개선). 보안 저하 없음.

### 3. `codebase/packages/expression-engine/src/parser.ts`

`case TokenType.LParen:` 를 블록(`{ }`)으로 감싼 것은 `no-case-declarations` ESLint 규칙 위반 수정이며 파싱 로직·AST 산출물은 동일하다. 보안 영향 없음.

### 4~5. `plan/complete/spec-draft-avatar-storage-key.md` (신규, `in-progress`→`complete` 이동) / `plan/in-progress/spec-draft-avatar-storage-key.md` (삭제)

파일 내용은 이미 구현된 아바타 업로드(`POST /api/users/me/avatar`)의 S3 키 설계를 spec 문서와 합치시키는 draft 문서이며, 애플리케이션 코드 변경이 아니라 문서 이동(git mv 상당)이다. 다만 이 draft 가 서술하는 보안 설계 자체를 참고용으로 짚어 둔다(코드 변경분이 아니므로 CRITICAL/WARNING 판정 대상은 아님):

- **공개 버킷 + UUID 키 기반 접근 통제**: `avatars/{userId}/{uuid}.{ext}` 키를 익명 `GetObject` 로 공개하고 `ListBucket` 만 차단해 "키를 모르면 못 연다"는 obscurity 모델을 채택했다고 문서화되어 있다. 문서 자체가 이 설계를 명시적 트레이드오프로 인정하고 있고(§Rationale, 2026-08-31 사용자 결정), 이번 PR 은 그 결정을 새로 도입하는 것이 아니라 기존 구현과 spec 텍스트를 맞추는 것뿐이므로 이 리뷰에서 새로 지적할 결함은 아니다. 다만 후속 검토 포인트로 남긴다 — UUIDv4 를 전제로 예측 불가능성이 성립하므로, 만약 실제 구현이 `crypto.randomUUID`/UUIDv4 가 아닌 다른 ID 생성기를 쓴다면(이 diff 범위 밖) 이 통제가 무력화된다.
- **확장자 화이트리스트에서 SVG 명시적 제외** — SVG 는 스크립트를 담을 수 있는 유일한 이미지 포맷이라 공개 URL 서빙 시 저장형 XSS 표면이 된다는 점을 정확히 짚고 있다. 좋은 방어 설계이며 이 문서가 그 근거를 명문화한 것도 긍정적이다.
- **`Content-Type` 을 클라이언트 `mimetype` 이 아니라 확장자에서 파생** — MIME 스니핑/컨퓨전 기반 공격(예: 업로드된 파일이 브라우저에 의해 HTML/스크립트로 해석되는 것)을 줄이는 관례적으로 올바른 선택으로 문서화되어 있다.
- 이 문서에는 실제 자격증명 값·시크릿이 포함되어 있지 않다 — `S3_BUCKET`, `S3_PUBLIC_BASE_URL` 등은 환경변수 **이름**만 언급되고 값은 `.env.example` 참조로 위임된다.

### 6. `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md`

CI/로컬 툴체인 차이를 진단하는 트러블슈팅 기록. 보안 관련 내용 없음.

## 뮤테이션 검증

이번 리뷰 대상 diff 는 전부 (a) 셸 quoting, (b) TS 타입 술어, (c) `switch` 블록 스코프, (d) 문서 이동으로, 저장소 파일을 수정해 재현해 볼 필요가 있는 보안 가설이 없었다. 저장소 트리를 뮤테이션하지 않았다(`git status --short` 로 clean 확인 불필요 — 애초에 아무것도 쓰지 않음).

## 요약

이번 changeset 은 신규 기능이나 사용자 입력 처리 경로를 추가하지 않는다 — lint 스크립트 quoting, 테스트 파일의 타입 레벨 리팩터, `switch/case` 스코프 수정, 그리고 이미 구현된 아바타 업로드 기능을 spec 문서에 맞추는 `plan/` 문서 이동으로 구성된다. 인젝션·시크릿 하드코딩·인증/인가 우회·안전하지 않은 암호화·민감정보 노출 에러 처리·의존성 취약점 어느 항목에서도 새로 도입된 결함을 발견하지 못했다. 리뷰 대상에 포함된 spec 문서가 서술하는 아바타 공개 URL 설계(UUID 기반 obscurity + `ListBucket` 차단 + SVG 제외 + 확장자 기반 Content-Type)는 이미 사용자 결정으로 채택된 트레이드오프이며 이번 diff 가 새로 도입한 것이 아니다.

## 위험도

NONE
