# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** 클래스 docstring 의 "fail-open 세 경로" 목록이 이번 diff 로 추가된 두 경로(엔트리 손상·payload 손상)를 반영하지 않아 stale 하다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:62-64`
  - 상세: 클래스 상단 docstring 은 "이 fail-open 은 **세 경로 모두**에 걸린다: 기동 시 미주입(생성자 null) · 조회 실패(`get()` reject) · 적재 실패(`set()` reject)" 라고 적는다. 이 열거는 diff 이전부터 이미 `직렬화 실패`(storeEntry 의 `JSON.stringify` catch, warn 함)를 누락하고 있었는데, 이번 diff 가 신설한 `discardCorruptEntry()` 는 **엔트리 손상**·**payload 손상** 두 자리를 추가로 warn-emitting fail-open 경로로 만들었다(각각 신규 테스트 `엔트리 손상은 조용히 넘어가지 않는다`, `엔트리는 멀쩡한데 안쪽 responseJson 이 깨진 경우` 로 고정됨). 결과적으로 지금 이 클래스는 warn 을 남기는 fail-open 경로가 최소 5곳(GET·SET·직렬화·엔트리 손상·payload 손상)인데 클래스 docstring 은 여전히 "세 경로"(그나마 다른 세 개: 생성자 null·GET·SET)라고 말해 **개수도 항목도 실제와 어긋난다**. 이 저장소는 같은 세션에서 "문서한 보장이 구현보다 넓다/좁다" 패턴을 이미 3회 지적받은 이력이 있다(plan §후속, `12_55_52` INFO 3 · `21_02_30` WARNING 2 등) — 이번 것은 그 반대 방향(구현이 문서보다 넓어짐)이지만 같은 근본 원인(코드 추가 시 클래스 레벨 인벤토리 미갱신)이다.
  - 제안: 상단 docstring 의 "세 경로" 문장을 "다섯 경로(생성자 null · GET 실패 · SET 실패 · 직렬화 실패 · 캐시 엔트리/payload 손상)" 식으로 갱신하거나, `discardCorruptEntry()`/`storeEntry()` 자체 JSDoc 을 가리키는 참조로 바꿔 두 군데가 서로 다른 개수를 주장하지 않게 한다.

- **[WARNING]** 이 인터셉터의 최근 3개 커밋은 모두 `CHANGELOG.md` 에 `## Unreleased` 항목을 남겼는데, 이번 fix(캐시 엔트리 안쪽 `responseJson` 손상 → 500 마스킹 방지)만 빠져 있다.
  - 위치: `CHANGELOG.md` (신규 섹션 없음) — 비교 대상은 기존 항목 `CHANGELOG.md:3`(캐시 키 스코프), `CHANGELOG.md:34`(409/410 캐시), `CHANGELOG.md:62`(Redis 런타임 fail-open)
  - 상세: `git show 22e68459d --stat` 로 확인한 이번 커밋의 변경 파일은 `idempotency.interceptor.ts` / `idempotency.interceptor.spec.ts` / `plan/in-progress/backend-lint-gate-broken-on-main.md` 세 개뿐이고 `CHANGELOG.md` 는 포함되지 않는다. 그런데 같은 인터셉터를 고친 직전 세 커밋(`8a2d13031` 캐시 키 스코프, `a80599700` §R8 409/410, 그 이전 Redis 런타임 fail-open)은 전부 client-observable 변화를 `CHANGELOG.md` 에 남겼다 — 이번 fix 도 관측 가능한 동작 변화다: 손상된 `responseJson` 캐시 엔트리를 만나면 종전엔 `SyntaxError` 가 `GlobalExceptionFilter` 를 거쳐 **500** 이 됐지만 지금은 신규 처리로 강등되고 warn 로그가 남는다. 확립된 관례(같은 세션·같은 기능 영역에서 3연속)를 이번 건만 건너뛴 모양새다.
  - 제안: 다른 세 항목과 같은 톤으로 `## Unreleased — 캐시 엔트리 내부 responseJson 손상 시 500 대신 fail-open` 섹션을 추가한다(증상 · 원인(바깥만 try/catch, 안쪽은 맨몸 파싱) · 클라이언트 영향 · 파싱 순서가 계약이 된 이유).

- **[INFO]** 테스트 파일의 최상단/블록 docstring 이 이번에 추가된 4건의 신규 테스트(엔트리 손상 warn · payload 손상 fail-open · 파싱 순서 고정 · 에러채널 자매)를 구체적으로 언급하지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:11-15` (최상단 파일 docstring), `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:236-243` (두 번째 `describe` 바로 위 블록 docstring)
  - 상세: 두 docstring 모두 "손상 캐시 JSON fallback" 정도로만 뭉뚱그려 언급할 뿐, 이번 diff 가 새로 고정한 성질들 — (1) `엔트리`/`payload` 손상 각각 warn 을 남긴다, (2) `bodyHash` 판정이 payload 파싱보다 먼저여야 한다는 순서 계약, (3) 에러 채널(409 상태)에서도 같은 방어가 적용된다는 자매 커버리지 — 를 요약하지 않는다. 각 `it()` 블록 자체의 인라인 주석은 매우 상세해 개별 근거는 충분히 남아 있지만, 파일을 훑어보는 사람이 "이 파일이 지금 무엇을 보장하는지" 를 상단 docstring 만으로 파악하기엔 최신성이 한 단계 뒤처져 있다.
  - 제안: 필수는 아니나, 두 번째 describe 블록 docstring에 "엔트리/payload 손상은 각각 warn 로그를 남기며, payload 파싱은 bodyHash 판정 뒤에 온다(순서 뒤집기는 회귀)" 한두 문장을 추가하면 향후 회귀 시 docstring 만 보고도 계약을 파악할 수 있다.

## 요약

프로덕션 코드(`idempotency.interceptor.ts`)의 신규 로직 자체는 문서화 품질이 높다 — `discardCorruptEntry()` 에 명확한 JSDoc, 파싱 순서·재현 분기 중복 제거 이유를 설명하는 인라인 주석, 그리고 plan 파일의 완료 기록도 근거(뮤테이션 실측, 무효 뮤턴트 함정 회피 경위)까지 충실히 남겼다. 다만 두 가지 축에서 문서 최신성이 코드 변경을 따라가지 못했다: (1) 클래스 레벨 docstring 의 "fail-open 세 경로" 인벤토리가 신규 두 경로(엔트리·payload 손상)를 반영하지 못해 실제보다 좁게 서술하고, (2) 이 인터셉터의 직전 세 커밋이 전부 남긴 `CHANGELOG.md` 항목이 이번 client-observable 동작 변화(500→fail-open)에는 빠져 있다. 테스트 파일 상단 docstring 의 미세한 뒤처짐은 INFO 수준이다. spec 문서(`5-system/14-external-interaction-api.md`, `data-flow/15-external-interaction.md`)는 이번 변경의 세부(엔트리 손상 처리)를 다룰 계약 레벨이 아니므로 갱신 불필요로 판단했다.

## 위험도

MEDIUM
