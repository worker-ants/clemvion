# 부작용(Side Effect) 코드 리뷰

## 대상 요약

이번 changeset 의 실질 코드 표면은 6개 파일이다: 신규 `codebase/backend/src/shared/utils/redact-stored-error.ts`(+spec),
`codebase/backend/src/modules/executions/executions.service.ts`(+spec),
`codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`(+spec),
DTO 주석 2곳(`execution-response.dto.ts`, `background-run-response.dto.ts`). 나머지 90여개 파일은
`.claude/docs/plan-lifecycle.md`·`CHANGELOG.md`·`plan/**`·`review/**` 문서로 런타임 부작용 표면이 없다
(경로 이동·문구 정정뿐, 실행 코드 없음).

핵심 변경은 DB `Execution.error`/`NodeExecution.error`(jsonb) 컬럼 값을 **응답 egress 시점**에
`redactStoredErrorForResponse`(`deepRedactSecrets` 위임)로 자격증명 패턴만 마스킹하는 것이다. 이미
3라운드(`17_12_34`→`17_35_49`→`17_56_15`) 리뷰를 거쳐 CRITICAL/WARNING 0 으로 수렴한 상태이며, 특히
직전 라운드 side_effect 리뷰가 `stop()` 반환 정체성 변경을 WARNING 으로 잡아 문서화·실측 조치가
이미 반영돼 있다. 아래는 그 상태를 독립적으로 재검증한 결과다.

## 발견사항

- **[INFO]** `stop()` 반환값의 정체성·타입이 바뀜(엔티티 참조 → 마스킹된 복사본, `Execution` → `ResponseExecution`) — 기존 WARNING 이 이미 문서화·검증됨, 재확인 결과 이상 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `stop`/`stopInternal`(공개 시그니처 변경 지점)
  - 상세: 종전에는 `stopInternal`(구 `stop`)이 재조회한 엔티티 **참조**를 그대로 반환했다. 이제
    `stop()` 이 `toResponseExecution()` 으로 감싸 **복사본**(마스킹된 `error`, `trigger`/`executor`
    제거)을 반환하고 반환 타입도 `Execution` → `ResponseExecution` 으로 좁아진다. 내부 소비자를
    grep 으로 재확인한 결과 `interaction.service.ts:226,248`·`hooks.service.ts:407` 는 반환값을
    버리고(`await this.executionsService.stop(...)` 후 미사용), 유일하게 값을 쓰는 곳은
    `executions.controller.ts:145`(`return this.executionsService.stop(id)` → HTTP 응답)뿐이다.
    `stopInternal` 이 호출하는 `findOne`(재조회 지점들)에 `relations` 지정이 없어 `trigger`/
    `executor` 는 애초에 로드되지 않으므로, 타입에서 제외돼도 응답 바이트 상 사라지는 필드는
    없다 — JSDoc 의 주장과 실측이 일치한다.
  - 제안: 조치 불필요. 이미 `17_12_34` 라운드 side_effect WARNING #3 으로 지적되고 문서화 +
    실측(RESOLUTION 참조)으로 닫힌 항목이라 재조치를 요구하지 않되, 공개 API(`POST /:id/stop`)의
    응답 **값**이 바뀌는 변경이므로 기록을 유지한다.

- **[INFO]** `getChain()` 반환 타입 변경(`Execution[]` → `ResponseExecution[]`) — 호출자 영향 없음, 확인됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:531` (`getChain`), 호출부
    `codebase/backend/src/modules/executions/executions.controller.ts:311`
  - 상세: 컨트롤러는 결과를 그대로 pass-through 할 뿐 내부에서 `trigger`/`executor` 필드를 다시
    읽는 코드가 없다(grep 확인, 다른 소비자 0곳). 타입 좁힘이 컴파일 타임에 그치고 런타임 동작에
    영향을 주지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 export `ResponseExecution`/`ResponseNodeExecution` 타입 — 외부 소비자 없음, 순수 추가
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`export type ResponseExecution`, `export type ResponseNodeExecution`)
  - 상세: 서비스 파일에서 신규로 export 되지만 `grep -rn "ResponseExecution\|ResponseNodeExecution"`
    결과 이 파일과 그 spec 외에는 참조하는 곳이 없다. 기존 공개 인터페이스를 변경하지 않는
    순수 추가(additive)다.
  - 제안: 조치 불필요.

- **[INFO]** `redactStoredErrorForResponse` 는 입력을 변이하지 않는 순수 함수 — 비변이 계약을 테스트로 고정, 재확인함
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:57-64`,
    검증: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:44-49`(`입력 객체를 변이하지 않는다`),
    `codebase/backend/src/modules/executions/executions.service.spec.ts` (`DB 원문은 건드리지 않는다 — egress-only`)
  - 상세: `deepRedactSecrets` 위임이 copy-on-change 로 동작해(변경 없으면 같은 참조 반환) 원본
    엔티티를 변이하지 않는다. 서비스단 테스트도 마스킹 후 `original`/`row.error` 가 원문
    그대로임을 별도로 단언해 "같은 객체를 참조하는 DB write 경로가 마스킹된 값을 쓰게 되는" 부작용
    가능성을 배제한다. 이는 §R17 egress-only 원칙(DB 는 원문 보존)을 코드 레벨에서 보증한다.
  - 제안: 조치 불필요.

- **[INFO]** `findById` 의 `NodeExecution.error` 마스킹에서 copy-on-change 삼항이 `error == null` 행에는 원본 참조를 그대로 반환 — `snapshotCache` 오염 경로 여부 재확인, 위험 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `findById` 내부
    `reconciledNodeExecutions` 산출부(`ne.error == null ? ne : { ...ne, error: ... }`),
    `writeSnapshotCache`/`readSnapshotCache`(같은 파일, 인스턴스 `Map` 기반 LRU)
  - 상세: 마스킹은 `writeSnapshotCache(id, snapshot)` **호출 이전**에 완료된 `snapshot` 객체에 대해
    수행되므로, 캐시에는 이미 마스킹된 값이 저장된다(원문이 캐시에 들어갔다가 나중에 마스킹되는
    순서 결함은 없음). `error == null` 인 행은 원본 `NodeExecution` 엔티티 참조를 그대로 응답에
    포함시키지만, 그 엔티티는 이 요청의 `manager.find(...)` 호출로 새로 조회된 객체라 다른 요청·다른
    실행과 공유되지 않는다 — 참조를 그대로 반환하는 것 자체는 부작용이 아니다. 다만 이 참조가
    `snapshotCache`(COMPLETED/FAILED/CANCELLED 상태에 한해 캐시됨)에 들어간 뒤 **호출자 쪽에서
    캐시 반환값을 변이**하면 다음 캐시 히트 응답까지 오염될 잠재 경로가 이론상 존재한다. 이는 이번
    diff 가 새로 만든 경로가 아니라 `readSnapshotCache`(`executions.service.ts:196-206`)가 원래도
    참조를 그대로 반환해 온 기존 설계이고, 현재 코드베이스에 이 반환값을 변이하는 지점이 없음을
    확인했다(직전 라운드 side_effect INFO 와 동일 결론).
  - 제안: 조치 불필요. 다만 향후 이 반환값을 다루는 신규 코드가 in-place 변이를 하면 캐시 오염으로
    이어질 수 있다는 점은 계속 유효한 캐비엇이므로, 이미 문서화된 상태를 유지 권고.

- **[INFO]** DTO Swagger 주석(`execution-response.dto.ts`, `background-run-response.dto.ts`) 변경은 문서 문자열뿐 — 런타임 부작용 없음
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:65-73,169-175`,
    `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:64-65`
  - 상세: `@ApiPropertyOptional` 의 `description` 문자열만 바뀌고 `type`/`additionalProperties`
    등 실제 직렬화·검증에 관여하는 필드는 그대로다. OpenAPI 스펙 문서(사람이 읽는 텍스트)만
    바뀌므로 런타임 동작·클라이언트 계약에 영향 없다.
  - 제안: 조치 불필요.

- **[INFO]** `.claude/docs/plan-lifecycle.md`/`CHANGELOG.md`/`plan/**` 문서 변경은 코드 실행 경로 밖 — 부작용 없음
  - 위치: `.claude/docs/plan-lifecycle.md:80-101`(`pending_plans` 신규 문서화 절), `CHANGELOG.md:3-35`,
    `plan/complete/eia-stalled-atomicity.md`(신규, 실제로는 `plan/in-progress/`→`plan/complete/`
    이동), `plan/in-progress/*.md` 다수(경로 참조 정정)
  - 상세: 순수 마크다운 문서다. `pending_plans` frontmatter 키는 문서 자체가 "plan 레벨에는
    가드가 없다 — 완료 판정에 쓰이지 않는다"고 명시하며, grep 결과 이 키를 런타임에 파싱해
    동작을 바꾸는 스크립트/훅은 이번 diff 범위에 없다(선언적 cross-link 전용). 나머지는 완료 plan
    이동(`in-progress/eia-stalled-atomicity.md` 삭제 + `complete/`에 동일 내용 생성)과 상호 참조
    경로 정정으로, 파일시스템 부작용은 "예상된" `git mv`-등가 이동뿐이고 실행되는 파일시스템
    조작 코드가 없다.
  - 제안: 조치 불필요.

## 확인했으나 문제 없음 (부작용 관점 교차 확인)

- **환경 변수**: 이번 diff 어디에도 `process.env` 읽기/쓰기 신규 도입 없음(grep 확인).
- **네트워크 호출**: 신규 `redact-stored-error.ts` 는 순수 정규식 기반 동기 함수, `import` 0개(외부
  I/O 없음). 소비처(`executions.service.ts`, `background-runs.service.ts`)의 변경분도 이미 조회된
  데이터에 대한 in-memory 변환이라 신규 외부 호출이 없다.
- **전역 변수**: 새 module-level mutable state 도입 없음. `deepRedactSecrets` 가 의존하는
  `DEEP_REDACT_CACHE`(`sanitize-error-message.ts` 의 module-level `WeakMap`)는 **기존 코드**이고
  이번 diff 의 수정 대상이 아니다 — 새 호출부(4곳)가 이 캐시에 추가로 접근하지만, 키가 TypeORM 이
  매 쿼리마다 새로 만드는 객체라 사실상 항상 캐시 미스이고(성능 리뷰가 이미 INFO 로 기록), `WeakMap`
  특성상 참조 해제 시 자동 GC 되어 메모리 누수·크로스 리퀘스트 오염 경로는 없다.
- **이벤트/콜백**: 이번 diff 의 변경 지점(`findById`/`getChain`/`stop`/`toExecutionDto`/
  `toNodeExecutionDto`)은 모두 emit·이벤트 발행과 무관한 응답 직전 변환 함수다. WS
  `execution.snapshot` 은 `findById` 를 재사용하므로 emit **호출 자체**는 변경되지 않고 그 안에
  실리는 값만 마스킹된다(회귀 위험 있는 "이벤트 발생 여부/횟수 변경"이 아니라 "payload 값 변경").
- **파일시스템**: 코드 표면(`.ts`)에 파일 I/O 신규 도입 없음.
- **인터페이스/시그니처**: `stop`/`getChain`/`toResponseExecution`(구 `stripPrivateRelations`,
  private) 시그니처 변경은 위 항목에서 다뤘고, `redactStoredErrorForResponse(err)` 는 신규
  export 라 기존 호출자에 영향이 없다.

## 요약

이번 changeset 은 응답 egress 시점에 `Execution.error`/`NodeExecution.error` 값을 마스킹하는
보안 후속 작업으로, 부작용 관점에서 유일하게 의미 있는 변화는 `stop()` 의 반환 **정체성**(참조 →
복사본)과 **타입**(`Execution` → `ResponseExecution`)이 바뀐 것인데, 이는 이미 이전 라운드
side_effect 리뷰가 발견·문서화·실측 검증까지 마친 항목이고 이번 재확인에서도 내부 소비자 2곳이
반환값을 버리고 유일한 소비자(컨트롤러)는 그대로 HTTP 응답으로 pass-through 함을 재확인했다.
전역 변수·환경 변수·파일시스템·네트워크 호출·이벤트 발생 패턴에 대한 새로운 부작용은 발견되지
않았다. 신규 `redact-stored-error.ts` 는 순수 함수로 비변이 계약이 테스트로 고정돼 있고, DB 원문
보존(egress-only)도 서비스 레벨 테스트로 별도 검증된다. 문서·plan 파일 변경은 런타임 부작용 표면이
없다.

## 위험도

NONE
