# 부작용(Side Effect) 리뷰 — HEAD 8d39d65ee

대상: `feat(external-interaction): EIA §R17 잔여 하드닝 — terminal outputData 마스킹 + deepRedactSecrets 캐시 + e2e`

## 발견사항

- **[INFO]** `DEEP_REDACT_CACHE`는 참조 불변(referentially-stable, 이후 in-place mutate 되지 않는) 입력을 전제한다 — 현재 호출부는 안전하나 미래 호출부에 대한 암묵적 계약
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:89, 109-125`
  - 상세: `DEEP_REDACT_CACHE`는 모듈 스코프 전역 `WeakMap<object, unknown>`으로, depth-0 입력 object identity를 키로 결과(같은 참조 또는 얕은 clone)를 캐싱한다. 캐시가 안전하려면 "동일 참조로 재호출되는 객체는 첫 호출 이후 절대 in-place mutate 되지 않는다"는 불변식이 성립해야 한다. 만약 어떤 호출부가 (a) 먼저 secret 이 없는 객체를 `deepRedactSecrets`에 넘겨 `result === value`(참조 그대로, 캐시에 `value → value` 저장)로 캐싱된 뒤, (b) 같은 참조를 in-place mutate 해 secret 값을 추가하고, (c) 같은 참조로 `deepRedactSecrets`를 재호출하면 — 캐시 hit 은 재-walk 없이 **캐시된 참조(=현재 시점엔 이미 mutate 된 동일 객체)**를 그대로 반환한다. 이 참조 동일성 때문에 실제로는 "오래된 결과"가 아니라 "현재 mutate 된 원본 그 자체"가 그대로 나가 마스킹을 우회한다. 부분적으로 마스킹된 경우(clone 이 만들어졌지만 특정 서브트리는 미변경이라 원본 참조를 그대로 공유)도 동일한 클래스의 문제가 나타날 수 있다(공유된 미변경 서브트리를 이후 mutate 하면 clone 을 통해서도 새 값이 그대로 보임).
  - 실제 영향 확인: 이번 diff 의 3개 신규/변경 호출부를 추적한 결과 이 리스크가 **현재는 트리거되지 않는다**.
    - `interaction.service.ts` `getStatus`: `execution`(및 `nodeExec`)은 매 호출마다 `this.executionRepository.findOne(...)`으로 **새로 조회**되는 TypeORM 엔티티라, `outputData`는 매 요청마다 새로 역직렬화된 객체 그래프(새 참조)다. 캐시 hit 은 사실상 발생하지 않고, 같은 참조가 나중에 mutate 되어 재유입되는 경로도 없다(로컬 변수, 요청 스코프 한정).
    - `ai-turn-orchestrator.service.ts:475, 820`: `deepRedactSecrets({...spread})`로 **매 호출마다 새 object literal**을 생성해 넘긴다 — 캐시 hit 불가(참조가 매번 다름), 안전.
    - `ai-turn-orchestrator.service.ts:745, 750, 872, 877`: `nextConv.messages`/`nextConv.presentations`/`condMessages`/`terminalPresentations` 도 각 turn 마다 `buildConversationConfigFromOutput`/필터링으로 새로 만들어지는 배열이며, 동일 참조로 반복 호출되는 지점이 없다.
    - `thread-renderer.ts:76, 83`: `turn.data`/`p.payload`는 주석에 명시된 프로젝트 불변식("ConversationTurn objects are immutable post-push")에 의존 — append-only, 이후 mutate 되지 않는다는 설계 전제가 이미 문서화돼 있다.
  - 이 캐시는 sibling `sanitizePayloadForWs`의 `SANITIZE_CACHE`(`websocket.service.ts:236`)와 **동형**이며 그쪽도 동일한 전제(가변 입력 비-mutate)를 이미 깔고 프로덕션에서 쓰이고 있다 — 신규 리스크가 아니라 기존에 수용된 패턴의 확장.
  - 제안: 신규 CRITICAL 은 아니지만, 향후 `deepRedactSecrets`에 "긴 생명주기를 갖고 반복적으로 mutate 되는 객체"(예: in-place로 필드를 append/patch 하는 캐시된 execution context 등)를 넘기는 호출부가 추가될 경우 이 캐시가 stale/우회 마스킹을 유발할 수 있음을 함수 docstring(현재 `DEEP_REDACT_CACHE` 주석)에 "입력은 이후 mutate 되지 않아야 한다"는 명시적 계약으로 한 줄 추가해두면 향후 회귀를 예방할 수 있다.

- **[INFO]** `cached !== undefined` sentinel 자체는 안전함을 코드로 확인
  - 위치: `sanitize-error-message.ts:118-124`, `deepRedactObject` (128-153)
  - 상세: depth-0 캐시 조회는 `value === null || typeof value !== 'object'` 얼리리턴(109-115) **이후**에만 도달하므로 캐시 키는 항상 non-null object(array 포함). `deepRedactObject`는 array 분기에서 `mutated ? out : value`, object 분기에서 `result ?? value`를 반환 — 두 경로 모두 입력이 non-null object 이므로 반환값이 `undefined`가 될 수 없다. 따라서 "정당한 결과가 `undefined`인 입력"과 sentinel 충돌 가능성은 없다(요청 프롬프트가 제기한 우려사항, 검증 결과 문제 없음).

- **[INFO]** `deepRedactObject` 추출 — 로직 무변경 확인
  - 위치: `sanitize-error-message.ts:128-153` vs `git show HEAD~1` 상의 인라인 버전
  - 상세: `HEAD~1`의 인라인 array/object walk 로직과 `deepRedactObject`로 추출된 코드를 diff 한 결과 **byte-for-byte 동일**(depth cap 처리 순서, credential-key wholesale 마스킹, copy-on-change 참조 보존 로직 모두 보존). 순수 리팩터, 회귀 없음.

- **[WARNING]** terminal `result`(COMPLETED)/`error`(FAILED)에 `deepRedactSecrets` 적용 — 기존 외부 API 소비자 대상 응답 형태 변경(의도된 보안 강화, 인지 필요)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:333-346`
  - 상세: 변경 전에는 `execution.outputData`가 **가공 없이** `result`/`error`로 그대로 노출됐다. 변경 후에는 `CREDENTIAL_KEY_PATTERN`(`password|token|secret|authorization|cookie|...`) 에 매칭되는 **키 이름을 가진 필드는 값의 성격과 무관하게 통째로 `'***'`로 치환**되고, 문자열 값은 `SECRET_LEAK_PATTERN`(`Bearer ...`, `client_secret=...` 등)에 매칭되면 마스킹된다. 이는 External Interaction API가 이미 공개(외부 통합 대상) 표면이라는 점에서, 워크플로 제작자가 **의도적으로** 최종 결과에 `token`/`secret`/`access_token`류 이름의 필드를 담아 반환하는 워크플로(예: "발급된 API 키를 결과로 돌려주는" 유스케이스)가 있다면 이번 변경으로 해당 필드가 조용히 `***`로 깨진다. `deepRedactSecrets`는 값이 아닌 **키 이름만으로** wholesale 마스킹하므로 false-positive 여지가 실제로 있다(plan 문서의 P2-4 "정밀도 — 수용/문서화" 항목에 이미 인지·문서화돼 있음).
  - 확인: `codebase/packages/sdk/src/client.ts:125`(`result?: Record<string, unknown> | null`)와 channel-web-chat 위젯 소비 코드를 확인한 결과, 현재 리포 내 소비처들은 `result`/`error`를 **opaque pass-through**로만 다루고 특정 키(`token` 등)를 프로그램적으로 파싱하지 않아 이번 변경으로 내부 소비처가 깨지는 즉각적 회귀는 없다. 다만 "외부(제3자) API 소비자"는 이 저장소 범위 밖이라 영향 범위를 완전히 확인할 수 없다.
  - 이 변경은 `plan/in-progress/eia-secret-masking-residuals.md`(P1-2)와 `spec/5-system/14-external-interaction-api.md` §R17 갱신을 통해 **의도적 결정**으로 문서화돼 있다("보안 우선, secret-shape 만 마스킹"). 따라서 차단 사유는 아니며, 리뷰 관점에서 "기존 사용자에 영향을 주는 공개 API 응답 형태 변경"이라는 사실 자체를 명시적으로 기록해 둔다.
  - 제안(선택): 변경 이력이 있는 API 이므로, 실제 외부 통합 파트너가 있다면 이번 변경을 changelog/API 문서에 공지하는 것을 고려. 코드/spec 관점에서는 이미 충분히 문서화됐으므로 추가 조치 불필요.

- **[INFO]** `null` 입력 처리 — 안전
  - 위치: `interaction.service.ts:335, 342`, `sanitize-error-message.ts:115`
  - 상세: `deepRedactSecrets(execution.outputData ?? null)`에서 `outputData`가 `null`/`undefined`면 `?? null`로 `null`이 전달되고, 함수 내부 `value === null` 얼리리턴으로 그대로 `null`을 반환한다(캐시 경로 미진입, 문제 없음). 기존 동작(`execution.outputData ?? null`)과 결과적으로 동일.

- **[INFO]** 성능/GC — WeakMap 사용 적절, 그러나 현재 호출부에서 실질 캐시 적중은 드묾
  - 위치: `sanitize-error-message.ts:89`
  - 상세: `WeakMap`이라 키 객체가 GC 되면 엔트리도 함께 회수돼 메모리 누수 위험 없음(값이 키 자신을 참조하는 unchanged 케이스 포함, WeakMap 의 약한 키 참조 특성상 문제 없음). 다만 위에서 분석했듯 이번 diff 의 실제 호출부(`getStatus`의 fresh entity, orchestrator 의 fresh object literal)는 대부분 매 호출 새 참조라 캐시 적중률이 낮다 — PR 설명이 언급한 "ForEach 등 동일 payload 반복 emit" 시나리오는 `sanitizePayloadForWs`(WS fanout, 동일 payload 를 N subscriber 에 반복 emit)의 실제 유스케이스이고, `deepRedactSecrets`는 각 emit-site 에서 1회만 호출되므로 캐시 이득은 제한적이다. 정확성엔 문제 없고 오버헤드(WeakMap get/set 2회)도 무시할 수준이라 문제로 보지 않음.

## 요약

이번 커밋은 `deepRedactSecrets`에 sibling `sanitizePayloadForWs`와 동형의 depth-0 WeakMap 캐시를 추가하고, `getStatus`의 terminal `result`/`error`(`execution.outputData`)에도 동일 마스킹을 적용했다. 캐시 정확성(sentinel 충돌, mutation 여부)을 코드 추적으로 검증한 결과 이번 diff 의 실제 호출부(모두 요청마다 새로 조회되는 DB 엔티티 또는 매 호출 새로 생성되는 object literal/배열)에서는 stale-cache 나 참조 동일성 파괴 문제가 발생하지 않으며, `deepRedactObject` 추출은 `HEAD~1` 대비 로직 무변경(순수 리팩터)임을 diff 로 확인했다. 유일하게 주목할 지점은 terminal `outputData` 마스킹이 기존에는 무가공으로 노출되던 공개 API 응답(`result`/`error`)의 형태를 변경한다는 점인데, 이는 plan/spec 에 이미 의도적 결정으로 문서화돼 있고 리포 내 소비처(SDK/위젯)는 opaque pass-through 라 즉각 회귀는 없다. 전역 상태 변경·파일시스템 부작용·환경 변수·네트워크 호출·이벤트 시그니처 변경은 발견되지 않았다. 관련 unit 테스트(`sanitize-error-message.spec.ts`, `interaction.service.spec.ts`) 63건 로컬 재실행 통과 확인.

## 위험도

LOW
