# 정식 규약 준수 검토 — `plan/in-progress/catalog-residual-codes.md`

## 발견사항

- **[WARNING] 신규 표 행의 도메인 cross-ref 링크가 앵커 없이 파일 루트만 가리킴**
  - target 위치: 변경 2a) `spec/5-system/3-error-handling.md` §1.2 신규 `NOT_A_MEMBER` 행 — `[data-flow §1.5](../data-flow/12-workspace.md)`
  - 위반 규약: 명시적 `spec/conventions/*.md` 항목은 아니나, **같은 §1.2 표 안의 기존 선례**(`TOKEN_INVALID` 행 `[data-flow §1.4](../data-flow/2-auth.md#14-refresh-token-회전)`, 그리고 `1-auth.md` §5 API 표 자신이 이미 쓰는 `data-flow §1.5` 링크 — `../data-flow/12-workspace.md#15-워크스페이스-전환-토큰-재발급`)와 형식이 어긋남
  - 상세: 라벨은 "§1.5" 를 명시하면서 실제 URL 에는 그 절로 점프하는 `#15-...` 앵커가 빠져 있어, 클릭 시 문서 최상단으로만 이동한다. 같은 `3-error-handling.md §1.2` 표의 `TOKEN_INVALID` 행이나 `1-auth.md` 자체가 동일 대상(`12-workspace.md` §1.5)을 가리킬 때는 앵커를 포함하는 것과 대비된다. `spec-link-integrity.test.ts` 는 파일 실존만 검증하므로(앵커 없는 링크는 그대로 통과) 이 drift 는 자동 가드로 걸러지지 않는다.
  - 제안: `[data-flow §1.5](../data-flow/12-workspace.md#15-워크스페이스-전환-토큰-재발급)` 로 앵커를 붙여 sibling 선례와 형식을 맞춘다.

- **[INFO] `이름` 컬럼에 괄호 부기 도입 — 기존 §1.2 표 스타일과 미세한 불일치**
  - target 위치: 변경 2a) `INVALID_PASSWORD` 행의 `이름` 값 — "비밀번호 재확인 실패(변경)"
  - 위반 규약: 명시적 컨벤션 문서 규칙은 아님(참고용). `3-error-handling.md` §1.2 기존 7행(`인증 필요`/`토큰 만료`/`권한 없음`/`Admin 권한 필요`/`로그인 실패`/`계정 잠김`)은 모두 `이름` 칼럼에 괄호 부기가 없고, 괄호 설명은 `설명` 칼럼에서만 쓰는 패턴이다.
  - 상세: 3중 근접명명(`INVALID_PASSWORD`/`PASSWORD_INVALID`/`PASSWORD_REQUIRED`) disambiguation 의도는 타당하나, 그 처리를 `이름` 칼럼이 아니라 `설명` 칼럼(이미 해당 행에 "재인증 코드 `PASSWORD_INVALID`(§1.2.1)... 별개" 로 기재 예정)에 집중시키면 표 전체 스타일이 더 일관된다.
  - 제안: `이름` 값을 "비밀번호 변경 재확인 실패" 처럼 괄호 없는 형태로 조정하거나, 현행 유지 시 사소한 스타일 편차임을 인지.

- **[INFO] `NOT_A_MEMBER` ↔ `ALREADY_A_MEMBER` 근접명명 미고지**
  - target 위치: 변경 2a)/2c) 전체 — `NOT_A_MEMBER` 신규 등재
  - 위반 규약: `spec/conventions/error-codes.md` §1 의미 기반 명명 원칙 자체 위반은 아니나, 본 target 문서가 이미 `INVALID_PASSWORD`/`PASSWORD_INVALID`/`PASSWORD_REQUIRED` 3중 근접명명에 대해 명시적 disambiguation 문구를 도입하는 것과 같은 태도를 다른 근접쌍에는 적용하지 않음. `error-codes.md` §3 예외 레지스트리에는 이미 UPPER_SNAKE `ALREADY_A_MEMBER`(워크스페이스 직접 추가 §1.9, 409)가 별도로 존재.
  - 상세: `NOT_A_MEMBER`(403, 워크스페이스 전환 시 비멤버) 와 `ALREADY_A_MEMBER`(409, 이미 멤버) 는 의미가 정반대라 실제 혼동 위험은 낮으나, 본 프로젝트가 근접명명에 대해 명시적 disambiguation 각주를 다는 관행(§1.2.1 "근접 명명 주의", `error-codes.md` §4 "레이어 주의")을 이미 확립했으므로 참고용으로만 표기.
  - 제안: 필수 조치 아님. 원한다면 `NOT_A_MEMBER` 설명 열에 "`ALREADY_A_MEMBER`(§1.9, 409)와 별개" 한 마디를 추가해 일관성을 더 높일 수 있음.

- **[INFO] 인용 선례("ADMIN_REQUIRED 선례")가 실제로는 다른 행이 더 정확한 선례**
  - target 위치: 변경 2a) 서두 — "도메인 cross-ref 는 설명 열 inline, ADMIN_REQUIRED 선례"
  - 위반 규약: 없음(문서 정확성 참고 사항).
  - 상세: 실제로 `ADMIN_REQUIRED` 행의 설명("...발행되는 `FORBIDDEN` 의 컨텍스트 특화 코드(`WorkspacesService.assertAdmin()` 발행)")에는 타 spec 문서로의 markdown 링크가 없다 — 서비스명만 inline code 로 언급. 같은 표의 `TOKEN_INVALID` 행이 오히려 `[data-flow §1.4](../data-flow/2-auth.md#14-refresh-token-회전)` 형태로 실제 원하는 패턴(설명 열에 도메인 cross-ref 링크)의 진짜 선례다. 최종 포맷 자체는 타당하나 인용 근거가 부정확.
  - 제안: 근거 문구를 "TOKEN_INVALID 선례" 로 정정하면 검토자·후속 독자가 실제 패턴을 더 빠르게 찾을 수 있음. (표 포맷 자체는 그대로 두어도 무방 — 이미 유효한 선례가 존재.)

## 규약 준수 확인 (위반 없음 — 참고)

- **명명 규약**: `NOT_A_MEMBER`/`INVALID_PASSWORD`/`PASSWORD_REQUIRED` 모두 실제 코드(`workspaces.service.ts:553,729`·`auth.service.ts:1134`·`users.service.ts:76,84`·`auth.service.ts:74`)의 리터럴과 정확히 일치하며 `UPPER_SNAKE_CASE`([`error-codes.md`](../../../../../spec/conventions/error-codes.md) §1 표기)를 준수. 도메인 prefix 는 §1 "시스템 전역 공용 코드" 예외 범주(prefix-less)로 기존 §1.2 sibling 코드들(`AUTH_REQUIRED`/`TOKEN_EXPIRED`/`ADMIN_REQUIRED` 등)과 동일 계열이라 prefix 미부여가 정합.
  - HTTP status 도 실제 예외 타입(`ForbiddenException`→403, `UnauthorizedException`→401)과 target 표 기재값이 일치.
- **출력 포맷 규약**: 신규 3행이 §1.2 표의 기존 4컬럼(`코드 | 이름 | 설명 | HTTP`) 스키마를 그대로 따름 — 컬럼 신설·변형 없음.
- **문서 구조 규약**: 변경이 각 spec 문서의 기존 3섹션 구조(Overview/본문/Rationale) 경계를 존중 — §5 note·§1.2 표 행은 본문에, 신규 Rationale bullet(2c)은 `## Rationale` 절에 정확히 배치. 새 파일·`0-` prefix·`_product-overview.md` 관련 컨벤션은 본 변경 범위 밖(기존 파일 편집만).
- **API 문서 규약**: 3코드 모두 기 구현·기 발행 코드이며 본 plan 은 코드 변경을 수반하지 않음 — swagger 데코레이터 신설 대상 아님. `spec/conventions/swagger.md` 위반 없음.
- **금지 항목**: `error-codes.md` §2 "이름 정확성 향상만을 위한 rename 금지" 위반 없음(신규 코드 아님, 재명명도 아님, 순수 spec 문서화). `spec-impl-evidence.md` frontmatter 스키마(`worktree`/`started`(ISO)/`owner`) 충족, `spec_impact` 도 리스트 형식(bare string 아님)으로 §Gate C 흔한 실패형을 피함.
- 플레이스홀더 앵커 `<slug-23c>`(변경 1b) 는 "github-slugger 실측 후 확정" 이라고 명시적으로 TODO 표기 — 추측 주입 없이 검증 절차를 남긴 점은 오히려 모범적.

## 요약

target plan 은 실제 코드의 에러 코드 리터럴·HTTP status 를 정확히 반영하고, `UPPER_SNAKE_CASE` 명명·prefix-less 예외 범주·4컬럼 표 스키마·Overview/본문/Rationale 섹션 배치 등 핵심 정식 규약을 모두 준수한다. 발견된 항목은 모두 WARNING 1건(도메인 cross-ref 링크의 앵커 누락 — sibling 선례와 형식 불일치) 과 INFO 3건(표 스타일 미세 편차·근접명명 disambiguation 확장 여지·선례 인용 부정확)으로, 어느 것도 다른 시스템의 invariant 를 깨뜨리는 CRITICAL 수준이 아니다. WARNING 항목만 반영하면 규약 준수도가 더 높아진다.

## 위험도
LOW
