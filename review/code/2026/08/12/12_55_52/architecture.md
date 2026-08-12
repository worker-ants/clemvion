# 아키텍처(Architecture) Review — 세션 `12_55_52` (누적 diff, 5번째 아키텍처 라운드)

## 컨텍스트 — 이 델타는 이미 4차례 검토됐다

이번 diff(`origin/main...HEAD`, 62개 변경 파일)는 backend lint `no-unsafe-*` warning 전량 처분
(46→0, `--max-warnings 0` 게이트 도입) 작업이며, 그중 architecture 관점 대상은 실질 코드 14개
파일 + `package.json` + `README.md` + plan 문서(파일 1~15)뿐이다. 나머지(파일 16~62)는
`review/code/2026/08/12/{11_06_12,12_05_39,12_24_14,12_40_58}/*` — 이전 4개 리뷰 세션의 산출물
(RESOLUTION/SUMMARY/reviewer md/meta.json/`_retry_state.json`)이 순차 커밋되어 diff 에 재노출된
것이다. 이 문서들은 코드가 아니라 리뷰 프로세스 기록이므로 SOLID·결합도·레이어·순환 의존성 등
아키텍처 점검 관점이 적용될 대상이 아니다.

architecture 는 이미 라운드 `12_05_39`(파일 29, 이번 diff 안에 그대로 들어 있음)에서 14개 소스
파일을 상세 검토해 CRITICAL/WARNING 없이 INFO 4건·위험도 NONE 으로 판정했고, 그 이후 두 라운드
(`12_24_14`, `12_40_58`)의 maintainability/side_effect 재확인 결과 해당 14개 파일은 재수정되지
않았다(단, `idempotency.interceptor.ts`/`idempotency.interceptor.spec.ts` 는 **주석·테스트만**
추가로 변경됨 — 아래 참조). 이번 라운드에서는 (a) 그 판정이 여전히 유효한지 소스를 직접 열어
재검증하고, (b) 직전 라운드(`12_40_58`) 이후 새로 반영된 커밋(`b0b57366f`, `7c7aee1c4`,
`cec79b004`)이 아키텍처 관점에서 새 문제를 들여왔는지만 집중 확인했다.

## 재검증 방법

- `git diff 336525805..HEAD --stat -- codebase/backend/src codebase/backend/package.json codebase/backend/README.md plan/` 로 실질 코드 diff 범위를 재확인 — 15개 파일, 14개 소스 + package.json + README + plan(정확히 파일 1~15와 일치).
- `getResponse<T>()` 패턴 3-way 스타일 분기를 저장소 전체에서 재grep해 라운드 `12_05_39` 아키텍처 리뷰의 관찰이 여전히 정확한지 확인.
- `codebase/backend/src/modules/chat-channel/types.ts` 의 import 를 열어 `SetupResult` 를 정의하는 모듈이 여전히 leaf 모듈(순환 의존 없음)인지 확인.
- `migrate-node-output-refs.ts` 의 `current.replace(...)` 호출 개수를 재세어 콜백 시그니처 반복 규모(6곳)가 라운드 간 변하지 않았는지 확인.
- `idempotency.interceptor.ts` 전문을 다시 읽어 이번 라운드에 반영된 주석 정정(`:42`, `:122-130`, `:157-159`)이 구조(클래스 책임·메서드 경계)에 영향을 주지 않는 순수 서술 변경인지 확인.

## 발견사항

- **[INFO]** `getResponse<T>()` 타입 좁히기 스타일 3-way 분기 — 재확인, 변화 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`(함수 밖 `HttpResponseLike` 인터페이스 선언부, 함수 `intercept`·`cacheTapped` 내 사용처)
  - 상세: `http-exception.filter.ts`/`interaction-rate-limit.guard.ts` 는 express `Response` 전체를, `logging.interceptor.ts` 는 인라인 익명 구조 `{ statusCode: number }` 를, 이 파일은 named 인터페이스 `HttpResponseLike`(옵셔널 필드 + `typeof` 런타임 가드)를 쓴다 — 라운드 `12_05_39` 가 이미 지적한 3-way 분기가 이번 라운드에도 그대로다. 이 델타가 새로 만든 비일관성이 아니고(기존에 이미 2 스타일 공존), `HttpResponseLike` 를 이 형태로 만든 근거(express `Response` 를 직접 쓰면 `typeof` 방어가 정적으로 항상 참이 되어 죽은 코드가 됨)가 코드 주석에 명시돼 있어 이 자리의 선택 자체는 여전히 타당하다.
  - 제안: 조치 불요. 다음에 `getResponse<T>()` 자리를 또 만질 때 공유 위치로 통일 고려(반복 확인).

- **[INFO]** `migrate-node-output-refs.ts` 정규식 pass 파이프라인의 콜백 시그니처 반복 6곳 — 재확인, 변화 없음
  - 위치: `codebase/backend/src/scripts/migrate-node-output-refs.ts:247-252`(Pass 1), `:292-297`(Pass 2), `:312-317`(Pass 3), `:332-337`(Pass 4), `:437-442`(meta 유지 pass), `:487-492`(error 필드 pass)
  - 상세: `current.replace(...)` 호출이 소스에 정확히 6곳 남아 있어(직접 재grep 확인) 라운드 간 pass 개수 변화가 없다. 개방-폐쇄 원칙 관점에서 `{ pattern, replacer }[]` 데이터 구조로 승격할 여지가 있다는 이전 판단은 여전히 유효하나, 1회성 마이그레이션 스크립트·7개 미만 규모에서는 과잉 추상화가 될 소지가 있어 강제 사유는 아니다.
  - 제안: 조치 불요. pass 수가 유의미하게 늘어나는 시점에 재고려.

- **[INFO]** `triggers.service.ts → chat-channel/types.ts` 모듈 엣지 — 순환 의존 없음, 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:31`(`import { ChatChannelConfig, SetupResult } from '../chat-channel/types';`)
  - 상세: `chat-channel/types.ts` 는 `../../shared/conversation-thread/conversation-thread.types` 하나만 import 하는 leaf 모듈임을 직접 확인했다 — `triggers` 도메인 서비스가 `chat-channel` 의 공개 타입 계약을 소비하는 기존 엣지에 named import 하나가 얹힌 것뿐, 신규 결합·역방향 의존·순환 참조 없음.
  - 판정: 문제 없음.

- **[INFO]** 이번 라운드에 반영된 소스 주석 정정(`b0b57366f`, `7c7aee1c4`, `cec79b004`)은 구조 변경이 아니라 서술 정정 — 확인 목적
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:42-45`(`IdempotencyEntry.responseJson` JSDoc), `:122-130`(`cacheTapped` 메서드 docstring), `:157-159`(에러 분기 주석)
  - 상세: `cacheTapped` 메서드의 책임(status 200~399 판정 후 Redis 적재)·`IdempotencyInterceptor` 클래스의 단일 책임(idempotency 캐시 처리)·메서드 경계 어느 것도 바뀌지 않았다. 바뀐 것은 그 로직이 Spec EIA §R8 과 어떻게 어긋나는지를 정확히 서술하는 JSDoc 뿐이다(직전 두 라운드가 "R8 이 4xx 를 전부 제외한다" 는 잘못된 근거로 테스트/주석을 심었던 것을 이번 라운드가 정정). `removeComments: true` 하에서 emit 이 origin/main 대비 바이트 동일함이 side_effect 리뷰(라운드 `12_40_58`)로 실증돼 있어, 이 변경이 순수 문서 정정이라는 판단과 정합한다.
  - 판정: 아키텍처 관점 영향 없음.

- **[INFO]** `idempotency.interceptor.spec.ts` 의 `makeInterceptor` 헬퍼 추출 — 테스트 구조 응집도 개선, 발견 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (생성자 인라인 호출 7곳 → 로컬 팩토리 1곳으로 통합, `12_40_58` 라운드 조치)
  - 상세: 이전 라운드(`12_24_14`)에서 architecture/maintainability 가 관찰했던 "같은 블록 내 `bodyHashOf` 는 헬퍼로 뽑았는데 생성자 호출은 인라인 반복" 이라는 스타일 비일관이 이번 라운드에 해소됐다(`redisConn` 주입 우선순위를 검증하는 W-4 블록 4건만 의도적으로 생성자를 그대로 둔 이유가 헬퍼 docstring 에 남아 있음). 이는 테스트 파일 내부의 응집도 개선이라 코드베이스 전체 아키텍처에 영향은 없지만, 지적된 비일관성이 실제로 해소됐음을 아키텍처 관점에서도 확인해 둔다.
  - 판정: 문제 없음.

CRITICAL/WARNING 급 아키텍처 결함은 발견되지 않았다.

## 요약

이번 델타(누적 5라운드째)의 실질 코드 변경은 여전히 라이브러리 경계(`EntityManager.query()`,
`Array.isArray` 좁힘, `TransformFnParams`, `.bind`, `Map.Iterator.next().value`,
`ExecutionContext.getResponse()`)에서 새던 암묵적 `any` 를 명시 타입·제네릭·구조적 인터페이스로
막는 순수 타입 강화이며, 이번 라운드에 새로 반영된 3개 커밋도 로직이 아니라 소스 주석·테스트
이름·테스트 헬퍼 구조를 정정한 것뿐이다(emit 바이트 동일이 브랜치 전체에 걸쳐 재실증됨). 14개
소스 파일을 직접 재검증한 결과 SOLID·레이어 분리·순환 의존성·모듈 경계 어느 축에서도 구조적
퇴행이 없다. 유일하게 반복 관찰되는 것은 (1) 동일 `getResponse<T>()` 진입점에 대한 타입 표현
스타일이 파일마다 3갈래로 갈려 있다는 점과 (2) `migrate-node-output-refs.ts` 의 6개 pass 가
향후 규모가 커지면 데이터 기반 파이프라인으로 승격할 여지가 있다는 점인데, 둘 다 라운드
`12_05_39` 부터 동일하게 관찰돼 온 것으로 이번 라운드가 새로 만든 문제가 아니고 지금 강제할
사안도 아니다. `review/**` 산출물(파일 16~62)은 코드가 아니라 리뷰 프로세스 기록이라 아키텍처
점검 대상 밖이다.

## 위험도

NONE
