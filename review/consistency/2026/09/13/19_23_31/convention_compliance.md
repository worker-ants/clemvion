# 정식 규약 준수 검토 — convention_compliance

## 대상 요약

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
- `spec/conventions/**` 델타: **0개 파일** (정상 — 이 브랜치는 conventions 문서를 바꾸지 않는다)
- 실제 구현 diff (4파일, `codebase/frontend/**`):
  - `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx` — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 "코드로 실행 실패" → "메시지 접두일 뿐 전용 코드 없음" 으로 문장 정정 (ko/en 동시)
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes` + `GUIDE_NON_EMITTED_VOCABULARY` 신설 ("발행 축" 가드)
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 위 가드에 대한 테스트 8종

이 배치는 `plan/in-progress/error-code-emission-axis.md` 가 트래커 CRITICAL(가이드 에러 코드 가드가 "존재" 만 보고 "방출" 을 안 봄)을 닫는 후속 작업이다. `spec/conventions/error-codes.md`, `spec-impl-evidence.md`, `user-guide-evidence.md`, `review-citations.md`, `i18n-userguide.md`, `node-output.md` 를 대조해 검토했다 (전부 워킹트리 절대경로에서 실측).

## 발견사항

### INFO — 신설 "발행 축" 가드가 어느 정식 규약에도 소속되지 않는다

- target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신설 `GUIDE_NON_EMITTED_VOCABULARY`, `collectQuotedLiterals`, `collectMessagePrefixes`, `collectCatalogCodes`) + `guide-identifier-existence.test.ts` (신설 "발행 축" describe 블록)
- 관련 규약: `spec/conventions/spec-impl-evidence.md` §4 / `spec/conventions/user-guide-evidence.md` §2 — 이 저장소는 build-time 가드를 신설할 때 그 가드를 소유하는 정식 규약 문서의 `code:` frontmatter 에 등재하는 관례를 매우 엄격히 지킨다 (예: `spec-impl-evidence.md` 는 자신의 4개 가드 파일을, `user-guide-evidence.md` 는 자신의 3개 가드 파일을 각각 `code:` 에 명시).
- 상세: "가이드 식별자 실재성 가드"(`guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`) 계열은 `#1330`/`#1331`부터 이번 배치까지 세 라운드에 걸쳐 커졌고 이제 존재 축 + 발행 축 두 축, `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` 두 예외 레지스트리를 갖는 상당한 규모의 build-time 가드가 됐다. 그런데 `spec/conventions/**` 어디에도 이 가드 family 를 소유·설명하는 문서가 없다 (`grep -rn "guide-identifier" spec/` 0건). `user-guide-evidence.md` 가 "가이드 → 코드" 역방향 갭을 다루는 가장 근접한 문서이지만 그 문서의 `code:` 목록에도 이 두 파일이 없다.
- 이것은 **이 배치가 새로 만든 결함이 아니다** — 가드 자체는 이전 두 PR(`#1330`/`#1331`)에서 이미 이 상태였고, 이번 배치는 기존 파일을 확장했을 뿐이다. 다만 이번 배치로 그 가드의 표면(예외 레지스트리 2종, export 함수 6종)이 한 단계 더 커졌으므로, 이 프로젝트가 다른 모든 build-time 가드 family 에 요구하는 "정식 규약 문서 + `code:` 등재" 패턴과의 괴리도 그만큼 커졌다.
- 제안: 이 배치에서 즉시 고칠 필요는 없다 (스코프 밖 — plan 자체가 "동작 변경/신규 규약은 별 배치" 원칙을 명시적으로 따르고 있다). 다만 후속으로 `spec/conventions/user-guide-evidence.md` 에 이 가드 family 를 §(신규 절)로 편입하거나, 별도 소규모 convention 문서(`guide-identifier-existence.md`)를 만들어 `code:` 에 두 파일을 등재하는 것을 권한다. 굳이 새 문서를 만들지 않는다면 최소한 `plan/complete/guide-identifier-existence.md` 에 "이 가드는 의도적으로 정식 규약 문서 없이 코드 주석 SoT 로 유지한다"는 결정을 명시해 다음 사람이 같은 질문을 반복하지 않게 한다.

## 준수 확인 (위반 아님 — 대조 근거로 기록)

- **`error-codes.md` §1 (의미 기반 명명, UPPER_SNAKE_CASE)**: `MAKESHOP_UNRESOLVED_PATH_PARAM`/`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 모두 UPPER_SNAKE_CASE + 의미 기술형 이름이라 §1 형식과 충돌하지 않는다. 이 토큰들은 `output.error.code`/`ErrorCode` enum 에 실제로 발행되는 값이 아니라 **메시지 접두 문자열**이므로 §3(historical-artifact 예외 레지스트리)·§4(내부 분류→public 코드 정규화) 어느 표에도 등재 의무가 없다 — 두 절 다 "실제로 `code` 필드로 나가는 값"을 대상으로 한다.
- **`review-citations.md` §2·§3**: 신규 코드/테스트 주석의 리뷰 인용은 전부 `review/consistency/2026/09/13/18_40_54` 형태(전체 경로, 날짜 포함)를 쓴다 — bare `hh_mm_ss` 없음. `#1330`/`#1331` 같은 PR 번호 인용은 이 규약의 적용 대상(`review/**` 세션 경로)이 아니다.
- **`i18n-userguide.md` Principle 5 (로케일 sibling 규약)**: `logic.mdx`(canonical, frontmatter 보유)와 `logic.en.mdx`(frontmatter 없는 본문만)를 동시에 수정했고 두 문장의 의미가 정확히 대응한다 — sibling 갱신 원칙 준수.
- **`i18n-userguide.md` Principle 6 (문체)**: 정정된 한국어 문장이 기존 해요체("연결해야 해요" 등)와 동일 톤을 유지한다.
- **`spec-impl-evidence.md`**: 이번 diff 는 `spec/conventions/**.md` frontmatter 를 건드리지 않으므로 §2~§4 의 frontmatter 스키마·가드 규칙이 직접 적용될 대상 변경이 없다.

## 요약

이번 배치는 `spec/conventions/` 문서 자체를 변경하지 않는 코드 전용 PR이며, 검증 결과 어떤 정식 규약도 직접 위반하지 않는다. 새로 등록한 `GUIDE_NON_EMITTED_VOCABULARY` 항목(`MAKESHOP_UNRESOLVED_PATH_PARAM`/`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`)은 `error-codes.md` 의 명명·표기 규칙(UPPER_SNAKE_CASE, 의미 기반 명명)과 충돌하지 않고, 이들이 구조화된 `error.code` 로 발행되지 않는다는 사실도 `error-codes.md` §3/§4 의 등재 의무 범위 밖이라 정합적이다. ko/en 가이드 문장 정정은 `i18n-userguide.md` Principle 5·6 을 그대로 따른다. 유일하게 짚을 점은 이 배치가 확장한 "가이드 식별자 실재성" 가드 family 가 (기존부터) 어떤 정식 `spec/conventions/*.md` 문서에도 `code:` 로 소유되지 않는다는 구조적 공백인데, 이는 이번 diff 가 만든 결함이 아니라 선행 PR(`#1330`/`#1331`)부터 있던 상태이고 plan 자체가 이번 배치의 스코프를 좁게 유지하려는 의도를 명시하고 있어 INFO 로만 기록한다.

## 위험도

NONE
