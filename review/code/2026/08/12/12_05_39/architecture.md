# 아키텍처(Architecture) 리뷰 결과

## 개요

이 변경은 backend lint `no-unsafe-*` warning 처분(46→21→0, `--max-warnings 0` 게이트 도입)을 목적으로 한 **타입 주석·제네릭 인자·타입 단언 추가뿐인 기계적 변경**이다(12개 소스 파일 + `package.json` lint 스크립트 + plan 문서). 로직 분기·함수 시그니처의 런타임 형태·모듈 export 표면은 변경되지 않았다(side_effect 리뷰가 emit JS md5 비교로 이미 실증). 이 성격상 SOLID·레이어 분리·순환 의존성·디자인 패턴 등 아키텍처 관점에서 구조를 바꾸는 지점은 사실상 없다. 아래는 그럼에도 관찰 가치가 있는 지점들이다.

## 발견사항

- **[INFO]** `ExecutionContext.switchToHttp().getResponse()` 타입 좁히기 전략이 파일마다 다르다 — 이번 변경이 세 번째 변형을 추가
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:34-37`(`HttpResponseLike` 인터페이스 신설), `:105`, `:128`(사용처)
  - 상세: 저장소 전체에서 같은 NestJS 패턴(`ExecutionContext.switchToHttp().getResponse<T>()`)에 대해 이미 두 가지 다른 타입 좁히기가 쓰이고 있다 — `http-exception.filter.ts:44`/`interaction-rate-limit.guard.ts:59`는 express `Response` 전체를 그대로 쓰고, `logging.interceptor.ts:54`는 익명 구조 타입 `{ statusCode: number }`를 인라인으로 쓴다(런타임 `typeof` 방어 없이 바로 구조분해). 이번 변경은 여기에 named 인터페이스 `HttpResponseLike`(옵셔널 필드 + `typeof` 런타임 가드 유지)라는 **세 번째 스타일**을 추가한다. 코드 주석이 "왜 express `Response`를 직접 쓰지 않는가"(정적으로 항상 참이 되어 방어가 죽은 코드가 됨)를 명확히 설명하고 있어 이 자리의 선택 자체는 근거가 충실하지만, 결과적으로 동일 NestJS 진입점에 대한 타입 표현 컨벤션이 파일마다 갈린 상태로 남는다. 이 diff 가 새로 만든 비일관성이 아니라(기존에도 두 스타일이 이미 공존) 세 번째 변형을 보탠 것뿐이라 이번 변경의 결함으로 보기는 어렵다.
  - 제안: 지금 당장 강제할 사안은 아니다. 다음에 `getResponse<T>()` 자리를 또 건드릴 일이 생기면, `HttpResponseLike` 류의 "구조 + 방어" 패턴을 `common/http/` 등 공유 위치로 옮겨 재사용 가능한 이름으로 통일하는 것을 고려할 수 있다.

- **[INFO]** `migrate-node-output-refs.ts` 의 정규식 pass 들이 암묵적 규칙 파이프라인 형태인데 반복되는 콜백 타입 시그니처로 표현되어 있음 (maintainability 리뷰의 DRY 지적과 같은 지점, 아키텍처 관점 보충)
  - 위치: `codebase/backend/src/scripts/migrate-node-output-refs.ts:247-252`(Pass 1), `:292-297`(Pass 2), `:312-317`(Pass 3), `:332-337`(Pass 4), `:437-442`(Pass 4b), `:487-492`(Pass 6) — 6곳이 동일 시그니처 `(match: string, dbl: string | undefined, sgl: string | undefined, field: string) => string`
  - 상세: 이 스크립트는 사실상 "정규식 패턴 → 치환 규칙" 목록을 순차 적용하는 파이프라인이다. 현재는 각 pass 가 `current = current.replace(regex, callback)` 형태로 인라인 반복되어 6곳에 같은 콜백 타입이 매번 풀어써 있다(1회성 마이그레이션 스크립트라는 성격을 고려하면 강제 리팩터 사유는 아니라는 maintainability 판단에 동의). 아키텍처 관점에서 덧붙이면, 이 반복은 "타입이 같다"는 신호이자 동시에 "이 스크립트가 암묵적으로 규칙 리스트 패턴을 흉내 내고 있다"는 신호이기도 하다 — 향후 pass 가 더 늘어난다면(예: 지금 7개 → 10개 이상) `{ pattern, replacer }[]` 형태의 명시적 데이터 구조로 승격하는 편이 개방-폐쇄 원칙(새 pass 추가 시 기존 pass 코드를 건드리지 않음) 관점에서 유리해질 수 있다. 지금 규모(7개, 1회성 스크립트)에서는 과잉 추상화가 될 수 있어 이번 diff 에서 요구할 사안은 아니다.
  - 제안: 조치 불요. pass 수가 유의미하게 늘어나는 시점에 재고려.

- **[INFO]** `package.json` 의 `--max-warnings 0` 도입은 아키텍처라기보다 빌드/품질 게이트 정책 변경이지만, 로컬-CI 게이트 단일화라는 점에서 구조적으로 긍정적
  - 위치: `codebase/backend/package.json:20`
  - 상세: CI(`backend-checks.yml`)가 `pnpm --filter backend lint` 를 그대로 호출하므로, 임계값을 CI 워크플로가 아니라 `package.json` script 자체에 넣은 선택은 "로컬 개발자 환경과 CI 가 같은 게이트 정의를 공유"하게 만든다 — 설정이 두 곳(워크플로 YAML과 package.json)으로 흩어져 서로 drift 할 여지를 원천적으로 없앤 것으로, 단일 진실 원천(SoT) 원칙에 부합하는 선택이다. 별도 조치 불요, 발견이라기보다 확인 사항.

- **[INFO]** `triggers.service.ts` 의 `SetupResult` import 추가는 기존 모듈 엣지에 named import 를 더한 것뿐이며 신규 결합·순환 참조 없음 (maintainability 리뷰와 교차 확인 결과 일치)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:31`
  - 상세: `chat-channel/types.ts` 는 `conversation-thread.types` 하나만 참조하는 leaf 모듈이고, `SetupResult` 도 같은 파일에 정의돼 있다(`types.ts:487` 부근). `triggers → chat-channel/types` 엣지는 이 diff 이전부터 존재했으므로(`ChatChannelConfig` 를 같은 줄에서 이미 import) 모듈 그래프에 변화가 없다. 레이어 경계(triggers 도메인 서비스가 chat-channel 어댑터의 공개 타입 계약을 소비하는 구조) 위반도 아니다 — `types.ts` 는 정확히 이런 cross-module 타입 계약을 위한 자리다.

## 요약

이번 델타는 아키텍처를 바꾸는 변경이 아니라 라이브러리 경계(`EntityManager.query()`, `Array.isArray` 좁힘, `TransformFnParams`, `.bind`, `Map.Iterator.next().value`, `ExecutionContext.getResponse()`)에서 새던 암묵적 `any` 를 명시 타입·제네릭·구조적 인터페이스로 막은 순수 타입 강화다. SOLID·레이어 분리·순환 의존성·모듈 경계 어느 축에서도 구조적 퇴행이 없고, `idempotency.interceptor.ts` 의 `HttpResponseLike` 는 "런타임 방어가 죽은 코드가 되지 않도록" 의도적으로 express `Response` 를 피한 근거가 명확한 좁은 추상화다. 유일하게 짚을 만한 것은 동일한 `getResponse<T>()` 진입점에 대한 타입 표현 스타일이 파일마다 세 갈래(전체 `Response`/익명 구조체/named 인터페이스)로 갈려 있다는 점과, `migrate-node-output-refs.ts` 의 6개 pass 가 향후 규모가 커지면 데이터 기반 파이프라인으로 승격할 여지가 있다는 점인데, 둘 다 이번 diff 가 새로 만든 문제가 아니고 지금 강제할 사안도 아니다. `package.json` 의 `--max-warnings 0` 을 CI 워크플로가 아니라 스크립트 자체에 건 것은 로컬/CI 게이트 drift 를 구조적으로 막는 선택으로 긍정적이다.

## 위험도

NONE
