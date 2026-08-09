# 요구사항(Requirement) 충족 리뷰

## 검증 방법

프롬프트의 unified diff 만으로는 판단이 어려운 3개 파일(`roles.guard.spec.ts`,
`secret-resolver.service.spec.ts`, `http-request.handler.spec.ts`)은 `Read` 로 전문을 직접
열어 확인했다. 추가로:

- 영향받는 5개 spec 파일 + 신규 e2e 파일을 `jest` 로 직접 실행 — **5 suites / 155 tests 전부 PASS**.
- 변경 파일 전체에 대해 `tsc --noEmit` — 이 diff 가 건드린 파일 범위에서 **타입 에러 0건**
  (레포 전역에는 무관한 기존 타입체크 갭이 있으나 이 diff 의 파일은 전부 깨끗함).
- `eslint` 로 변경 파일 전체 검사 — `workspace-reflection-canary.ts` 에 경고 1건(`no-unnecessary-type-assertion`, line 87)이 있으나 `git diff HEAD~1 HEAD` 로 대조한 결과 **이 diff 가 손댄 범위(JSDoc 주석)와 무관한 기존 코드**임을 확인(comment-only diff).
- `workspace-id-fixtures.ts` 의 `OTHER_WS` 값을 일시적으로 `TOKEN_WS` 와 동일하게 바꿔 뮤테이션
  테스트를 재현 — plan 문서가 주장한 **"2 suite / 3 test RED"** 를 그대로 재현 확인 후 원복.
- `secret_store` 마이그레이션(`V063__secret_store.sql`)의 CHECK 제약을 직접 읽어, 신규 e2e
  (`secret-store-like-prefix.e2e-spec.ts`) 주석의 "resourceId 는 `[^/]+` 라 `_`/`%` 를 허용한다"는
  주장을 실측 대조 — 정확함.
- `main.ts` 에서 `assertProductionConfig` → `assertWorkspaceIdReflectionWorks` → `app.listen` 순서를
  확인해 README 갱신 내용과 line-level 대조 — 일치.
- `roles.guard.ts`/`spec/data-flow/12-workspace.md` 의 "73건"과 캐너리 주석의 "142건"이 실제로
  상위집합/부분집합 관계로 서술돼 있는지 grep 대조 — 모순 없음.

## 발견사항

- **[INFO]** `workspace-reflection-canary.ts` 주석의 "142건" 실측치는 이 리뷰 세션에서 재실행으로
  독립 검증할 수 없었다(부팅 로그 기반 수치, 컨테이너 기동 필요).
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:26`
  - 상세: 코드 동작에는 영향 없는 순수 JSDoc 주석 변경이라 리스크는 낮다. `roles.guard.ts:48`
    ("222건 중 73건")·`spec/data-flow/12-workspace.md:319` 와의 포함관계(222 ⊇ 142 ⊇ 73) 서술은
    grep 대조 결과 자기모순이 없고, plan 문서(`auth-guard-reflection-hardening.md`)가 `make e2e-up`
    실측 절차를 구체적으로 기록해 뒀다. 코드 결함이 아니라 검증 불가능성만 기록해 둔다.
  - 제안: 조치 불요 — 향후 캐너리 로그 수치가 크게 달라지면(대규모 컨트롤러 추가/삭제) 이 주석도
    함께 갱신 대상이라는 점만 유의.

- **[INFO]** `review/consistency/2026/08/09/20_02_21/**` (파일 12~19)는 이번 diff 의 코드 변경과
  무관한 **별도 `--impl-prep` 세션의 산출물**이 그대로 커밋된 것이다.
  - 상세: 내용 자체(WARNING 4건 — Agent Memory RBAC 매트릭스 누락, `pending_plans` dangling
    reference, PR #1108 의 spec-lag, 감사 액션 카탈로그 선행 필요)는 이번 diff 의 코드와 직접
    관련이 없고, `spec/5-system/` 을 대상으로 한 사전 검토 리포트다. `requirement` 리뷰 관점에서
    이 파일들 자체는 기능 코드가 아니므로 "충족 여부" 평가 대상이 아니며, 내용도 이미
    developer 권한 밖(spec 쓰기)으로 정확히 분류돼 있다.
  - 제안: 조치 불요 — 정보 제공용 기록.

CRITICAL/WARNING 급 발견사항은 없다. 아래는 확인된 양호 사례(요구사항 충족 근거)다.

- **기능 완전성/반환값**: `assertWorkspaceIdReflectionWorks` 는 `count === 0` 시 명시적으로
  throw 하고, 그 외 경로에서는 항상 `number` 를 반환한다(모든 경로에서 값 보장, `common/decorators/workspace-reflection-canary.ts:116-122`).
- **엣지 케이스**: `workspace-id-fixtures.ts` 의 모든 UUID 픽스처가 canonical 8-4-4-4-12 hex 형태를
  갖춰 `isUuidShaped` 는 통과하되, `NIL_WS` 만 버전 nibble이 `0`이라 `isValidUuid` 는 거부하도록
  의도적으로 설계돼 있다 — 두 술어의 경계(RFC 버전 검사 vs DB-파싱 가능성)를 정확히 겨냥한 픽스처.
- **비즈니스 로직 일치**: `secret-resolver.service.spec.ts` 의 신규 자기-전제 단언(`_lastDeleteQuery`)이
  실제 `SecretResolverService.deleteByPrefix` 구현(`ref LIKE :prefix`, 패턴 `${prefix}%`, `ESCAPE`
  절 없음)과 정확히 일치함을 직접 코드 대조로 확인.
- **에러 시나리오**: mock 의 자기-전제 throw 문구(`LIKE 와일드카드`)와 프로덕션 가드의 거부 문구
  (`메타문자`)가 의도적으로 겹치지 않게 분리돼 있어, 가드 제거 회귀가 와도 기존
  `toThrow(/메타문자/)` 단언이 mock 의 throw 로 거짓 충족되지 않는다 — plan 문서가 스스로 기록한
  과거 실수("47/47 GREEN")의 재발을 코드 레벨에서 확인.
- **spec 일치**: `V063__secret_store.sql` 의 `chk_secret_store_ref_format` CHECK 는 resourceId 부분을
  `[^/]+` 로만 제한해 `_`/`%` 를 허용하므로, 신규 e2e 가 주장하는 "DB 가 아니라 애플리케이션
  가드만이 안전을 보장한다"는 전제가 실제 스키마와 일치.
- **회귀 방지**: `http-request.handler.spec.ts` 에서 제거된 `fetchPromise` 블록은 `Promise` 에
  존재하지 않는 `_reject` 속성을 optional-call 로 호출하는 실질적 no-op 코드였음을 직접 확인 —
  plan 문서의 "잔재 제거" 주장이 정확했고, 제거 후에도 해당 테스트(및 전체 스위트)가 그대로 통과.
- **TODO/FIXME**: 신규/변경 코드에 미완성을 시사하는 TODO·FIXME·HACK·XXX 없음(diff 전수 grep).

## 요약

`codebase/backend` 의 실질 코드 변경은 (1) README 배포 주의 절 구조화, (2) 3개 spec 파일에 흩어진
워크스페이스 UUID 픽스처를 공용 모듈로 승격, (3) 부트 캐너리 JSDoc 수치 정정(주석 only),
(4) `deleteByPrefix` LIKE 가드의 근거를 단위(연결점)+e2e(DB 의미론) 두 층으로 실행 가능하게 고정,
(5) http-request 핸들러 스펙의 죽은 스캐폴딩 제거로 구성된 위생성 followup PR이다. 모든 항목이
대응하는 `plan/in-progress/*.md` 체크리스트에 근거·뮤테이션 실측과 함께 정확히 기록돼 있고, 독립
검증(jest 155/155 PASS, 대상 파일 tsc/eslint 클린, 실제 마이그레이션 스키마·production 코드와의
line-level 대조, 뮤테이션 재현)에서 청구된 내용과 어긋나는 지점을 찾지 못했다. spec 문서 자체를
건드리는 변경은 없으며(developer 권한 범위 내), spec 반영이 필요한 항목(에러 코드 카탈로그·
검증 강도 비대칭 명문화 등)은 plan 에 planner 턴 필요로 정확히 미체크 상태로 남아 있다.

## 위험도

NONE
