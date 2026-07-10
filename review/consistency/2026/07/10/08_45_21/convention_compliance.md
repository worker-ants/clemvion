# 정식 규약 준수 검토 — convention_compliance

- target: `spec/5-system/3-error-handling.md` (§Overview·§1.2.1 신설·§1.8 신설·§Rationale 추가) + `plan/in-progress/error-codes-catalog-sot.md`
- 비교 대상 정식 규약: `spec/conventions/error-codes.md`, `spec/conventions/spec-impl-evidence.md`, `.claude/docs/plan-lifecycle.md`
- 재검토 사유: 이전 회차 CRITICAL(`#23-강제-종료-세션-revoke` dead anchor) + MEDIUM(`KB_REEMBED_IN_PROGRESS` 누락) 수정 반영 여부 확인

## 검증 방법

- `git diff HEAD -- spec/5-system/3-error-handling.md` 로 실제 변경분 확인 (주: `git diff origin/main..HEAD` 는 비어 있음 — 브랜치가 origin/main 과 동일 커밋이고, 변경은 아직 unstaged working-tree diff + untracked plan 파일 상태. 실질 변경은 이 working-tree diff 다).
- `codebase/frontend` 에서 `spec-link-integrity.test.ts` 직접 실행 → **11/11 PASS** 재확인.
- 테스트가 pin 한 `slugify` 함수를 직접 호출해 diff 내 모든 `#anchor` 링크와 대상 파일의 실제 heading slug 를 1:1 대조.
- `1-auth.md`·`10-graph-rag.md`·`8-embedding-pipeline.md` 원문을 읽어 신규 등재 9개 코드(§1.2.1 7개 + §1.8 2개)의 코드값·HTTP status·트리거 조건 문구를 도메인 SoT 와 대조.

## 발견사항

- **[없음] CRITICAL 없음 — 이전 회차 dead anchor 재확인 완료**
  - target 위치: §1.2.1 도입부, `[§2.3(재인증)](./1-auth.md#23-세션-정책)`
  - 위반 규약: 해당 없음 (수정 확인)
  - 상세: `slugify("2.3 세션 정책")` → `23-세션-정책` — 앵커가 `1-auth.md` 의 실제 heading(`### 2.3 세션 정책`, 1-auth.md:314)과 정확히 일치. `1.4(2FA/WebAuthn)` 앵커(`#14-2fa-two-factor-authentication`)도 `slugify("1.4 2FA (Two-Factor Authentication)")` 결과와 일치. diff 전체에서 `#`-fragment 를 쓴 링크는 이 2건 + 기존에 있던 `../conventions/error-codes.md#1-의미-기반-명명-핵심-원칙`(Rationale 신규 bullet, 검증 결과 일치) 뿐이며 나머지는 모두 파일 전체 링크(anchor 없음)라 anchor 무결성 위반 대상이 아니다. `spec-link-integrity.test.ts` 11/11 PASS 로 빌드 게이트 통과 재확인.
  - 제안: 없음 (조치 완료 확인).

- **[WARNING] §1.2.1·§1.8 "도메인 SoT" 컬럼이 §1.5·§1.7 의 정밀 앵커 패턴을 따르지 않음**
  - target 위치: `spec/5-system/3-error-handling.md` §1.2.1 표(56~62행)·§1.8 표(179~180행)의 "도메인 SoT" 컬럼
  - 위반 규약: 명시적 문서화 규칙은 아니지만, 동일 문서 내 §1.5(122~141행)·§1.7(159~169행)이 이미 확립한 "도메인 spec 참조" 패턴의 실질 관행(각 행이 실제로 가리키는 하위 섹션까지 `#anchor` 로 정밀 링크) — 이번 PRD 의 "§1.5–§1.7 패턴 준수" 요구사항과 직결
  - 상세: §1.5 는 모든 행이 `./6-websocket-protocol.md#42-...`·`./4-execution-engine.md#751-...` 처럼 구체 섹션 앵커를 건다. §1.7 도 `./12-webhook.md#52-400-응답-형식`·`#6-구현-파일-구조`·`#4-인증-방식` 등 행별로 다른 정밀 앵커를 건다. 반면 신설된 §1.2.1 은 7개 행 중 6개가 `[1-auth.md §5](./1-auth.md)`(앵커 없음, 4행 중복) 또는 `[1-auth.md §1.4.3](./1-auth.md)`·`[1-auth.md §1.1.B](./1-auth.md)`(모두 앵커 없음)이고, §1.8 도 `[10-graph-rag.md §5.1](./10-graph-rag.md)`·`[8-embedding-pipeline.md §7.3](./8-embedding-pipeline.md)` 둘 다 앵커가 없다. 링크 텍스트에는 정확한 §번호를 적어놓고 실제 href 는 파일 최상단으로만 연결되어, 독자가 해당 섹션을 수동으로 스크롤/검색해야 한다 — §1.5·§1.7 이 제공하는 원클릭 정밀 이동성이 §1.2.1·§1.8 에는 없다. (빌드 게이트는 위반 아님 — 프래그먼트가 아예 없으므로 `ANCHOR` violation 대상이 되지 않을 뿐, "패턴 준수" 관점에서는 격차.)
  - 제안: 각 행의 링크에 실제 heading anchor 를 추가. 확인된 정확한 슬러그: `./1-auth.md#143-webauthn-환경변수-옵션-기능`(§1.4.3 행), `./1-auth.md#5-api-엔드포인트`(§5 행 4개 — 표 전체가 §5 하나의 테이블이라 이 앵커가 최선), `./1-auth.md#11b-이메일-변경-흐름`(§1.1.B 행), `./10-graph-rag.md#51-추출--재추출`(§1.8 KB_REEXTRACT 행), `./8-embedding-pipeline.md#73-재임베딩`(§1.8 KB_REEMBED 행). 모두 `slugify()` 로 직접 검증 완료.

- **[INFO] "HTTP" vs "status" 컬럼 헤더 표기 불일치**
  - target 위치: §1.2.1(54행)·§1.8(177행) 표 헤더 `| 코드 | HTTP | 설명 | 도메인 SoT |`
  - 위반 규약: 명문 규약 없음 — 동일 문서 §1.6(147행)·§1.7(163행)은 같은 의미(HTTP status 코드) 컬럼을 `status` 로 표기
  - 상세: §1.2.1 은 자신이 속한 상위 섹션 §1.2(40행, `| 코드 | 이름 | 설명 | HTTP |`)의 "HTTP" 명명을 그대로 계승한 것으로 보여 국소적으로는 정당화 가능하나, §1.8 은 상위 섹션 없이 신설된 독립 도메인 참조 섹션이라 §1.6·§1.7 의 "status" 관행을 따르는 편이 카탈로그 전체 일관성 측면에서 더 자연스러웠을 것. 기능적 영향 없음(값 자체는 정확), 순수 표기 일관성 사안.
  - 제안: 선택 사항 — §1.8 헤더를 `status` 로 통일하거나, 혹은 이 기회에 `conventions/error-codes.md` 에 "도메인 참조 섹션 테이블은 `status` 컬럼명을 표준으로 한다" 같은 경량 규칙을 추가해 향후 §1.9+ 확장 시 흔들리지 않게 할 수 있음.

## 코드값 교차검증 결과 (도메인 SoT 대조)

| 신규 코드 | HTTP | 3-error-handling.md 표기 | 도메인 SoT 원문 대조 | 일치 여부 |
|---|---|---|---|---|
| `WEBAUTHN_DISABLED` | 503 | §1.2.1 | `1-auth.md` §1.4.3: "WebAuthn 엔드포인트는 모두 `503 WEBAUTHN_DISABLED` 반환" | 일치 |
| `WEBAUTHN_VERIFY_FAILED` | 400 | §1.2.1 | `1-auth.md` §5: "실패: 400 `WEBAUTHN_VERIFY_FAILED`" | 일치 |
| `INVALID_OPTIONS_TOKEN` | 400 | §1.2.1 | `1-auth.md` §5: "optionsToken 무효 시 400 `INVALID_OPTIONS_TOKEN`" | 일치 |
| `CHALLENGE_INVALID` | 401 | §1.2.1 | `1-auth.md` §5: "검증 실패: 401 `CHALLENGE_INVALID`" | 일치 |
| `WEBAUTHN_INVALID` | 401 | §1.2.1 | `1-auth.md` §5: "실패: 401 `WEBAUTHN_INVALID`" | 일치 |
| `RECOVERY_CODE_INVALID` | 401 | §1.2.1 | `1-auth.md` §5: "실패: 401 `RECOVERY_CODE_INVALID`" | 일치 |
| `REAUTH_NOT_AVAILABLE` | 403 | §1.2.1 | `1-auth.md` §1.1.B 표: "OAuth-only + 2FA 없음 → 403 `REAUTH_NOT_AVAILABLE`" | 일치 |
| `KB_REEXTRACT_IN_PROGRESS` | 409 | §1.8 | `10-graph-rag.md` §7: "`re-extract` 동시 호출 → ... 409 `KB_REEXTRACT_IN_PROGRESS`" | 일치 |
| `KB_REEMBED_IN_PROGRESS` | 409 | §1.8 | `8-embedding-pipeline.md` §7.3.2: "결과가 0행이면 `409 KB_REEMBED_IN_PROGRESS`" + `embedding_dimension = NULL` 초기화 문구까지 일치 | 일치 |

- 9개 코드 모두 `UPPER_SNAKE_CASE` 준수, `conventions/error-codes.md` 명명 규율과 배치되지 않음.
- 기존 §1 전체에서 중복 등재(동일 코드 재등록) 없음 — `grep` 으로 각 코드가 정확히 1회씩만 등장함을 확인.
- `plan/in-progress/error-codes-catalog-sot.md` frontmatter(`worktree`/`started`/`owner`)는 `.claude/docs/plan-lifecycle.md` §필수 필드 스키마 충족. `worktree: error-codes-catalog-sot-e09193` 는 실제 워크트리 디렉토리명과 일치.
- 문서의 Overview / 본문(§1~§7) / Rationale 3섹션 구조는 유지되었고, 신규 Rationale bullet 은 기존 항목들과 같은 리스트 레벨에 정상 삽입됨.
- §1.2.1 을 §1.2 의 하위 헤딩(`####`)으로, §1.8 을 최상위 형제 헤딩(`###`)으로 둔 구조적 비대칭은 2FA/WebAuthn 이 기존 §1.2(인증/인가) 표의 논리적 부분집합이라는 점에서 합리적 설계이며 위반으로 보지 않음.
- §1.2.1 말미의 제외 각주("`REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID` 는 아직 미문서화라 제외")는 `error-codes.md` 의 "spec 문서화 → 카탈로그 등재" 순서 원칙과 정합하며, dangling SoT 를 만들지 않으려는 의도적 축소 스코프로 규약 위반이 아님.

## 요약

이전 회차가 지적한 CRITICAL(dead anchor)은 `#23-세션-정책` 로 정확히 수정되어 `spec-link-integrity.test.ts` 11/11 PASS 를 재확인했고, MEDIUM(`KB_REEMBED_IN_PROGRESS` 누락)도 §1.8 에 정확한 HTTP status·트리거 조건과 함께 추가되어 도메인 SoT(`8-embedding-pipeline.md §7.3`)와 문구 단위로 일치한다. 신규 등재 9개 코드 전원이 도메인 SoT 원문과 코드값·HTTP status·트리거 조건이 정확히 일치하며 `UPPER_SNAKE_CASE`·"도메인 spec 참조" 표제·중복 등재 금지 등 명시 규약을 위반하지 않는다. 유일하게 남는 사안은 §1.2.1·§1.8 의 "도메인 SoT" 컬럼이 같은 문서의 §1.5·§1.7 이 확립한 "행별 정밀 앵커" 관행을 따르지 않아 링크 텍스트의 §번호와 실제 이동 지점이 어긋나는 WARNING 1건과, 컬럼 헤더 명명(`HTTP` vs `status`) 일관성에 대한 INFO 1건으로, 둘 다 빌드를 막지 않는 가독성/일관성 개선 여지다.

## 위험도

LOW — CRITICAL 없음. 이전 회차 CRITICAL·MEDIUM 모두 해소 확인. 잔여 사안은 WARNING 1건(정밀 앵커 누락, 비-차단) + INFO 1건(컬럼 헤더 명명)뿐이다.
