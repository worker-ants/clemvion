# 정식 규약 준수 검토 — spec/5-system/4-execution-engine.md §4.4 (+ data-flow/8-notifications.md §1.1)

> 검토 모드: --impl-prep. 대상 계획: (1) `finalizeFailedExecution` 헬퍼 추출(behavior-preserving),
> (2) spec §4.4 에 "순환 의존 처리 = forwardRef + ModuleRef(strict:false) 지연 해석 2종" 문서화 추가.

## 사전 확인 사항 (payload 스코프 불일치)

prompt_file 에 첨부된 "정식 규약 모음" 발췌(`audit-actions.md`, `cafe24-api-catalog/**`)는 target 계획(§4.4 이벤트
발행 sink / DI 순환 해석, notifications 알림 파이프라인)과 직접 관련이 없다 — cafe24 API 카탈로그 명명 규약이다.
이 발췌만으로는 target 을 제대로 검증할 수 없다고 판단해, 실제로 관련성이 높은 conventions
(`error-codes.md`, `node-output.md`, `spec-impl-evidence.md`, `migrations.md`)과 target 코드
(`execution-engine.service.ts`, `notifications.service.ts`)를 직접 조회해 교차 검증했다.

## 발견사항

- **[INFO]** ModuleRef 패턴 문서화가 §4.4 "단일 sink 정책" 서두와 병치될 때 독자 혼동 소지
  - target 위치: `spec/5-system/4-execution-engine.md` §4.4 (line 436-449, 특히 line 444 "순환 의존 처리" 문단)
  - 위반 규약: 명시적 위반은 아님. 문서 구조 규약(CLAUDE.md의 Overview/본문/Rationale 원칙 — 여기서는 "본문 결정문 vs Rationale" 배치)과 관련한 가독성 이슈.
  - 상세: 현재 §4.4 본문은 "순환 의존 처리 — forwardRef(() => WebsocketService) 로 해결" 한 문장으로 결론짓고, `ExecutionEventEmitter→WebsocketService` 의 forwardRef 지연해석 사례를 이어 붙였다. 계획대로 `ExecutionEngineService↔NotificationsService` 의 **ModuleRef(strict:false)** 지연 해석 사례를 같은 자리에 추가하면, 한 문단 안에 "forwardRef 로 해결"(명제) 뒤에 "그런데 이 경우는 ModuleRef 다"(반례처럼 읽힐 수 있는 예외)가 붙어 정책문의 단정성이 흐려질 위험이 있다. plan(`plan/in-progress/notif-followup-refactor.md` 항목2)이 이미 "적용 기준(생성자 주입이 인스턴스화 순서로 undefined 되는 @Optional 케이스 = ModuleRef)"을 명문화하려는 의도를 갖고 있으므로, 실제 target 갱신 시엔 "forwardRef vs ModuleRef 선택 기준"을 소제목 또는 표로 명확히 분리해 결정문 자체(어떤 걸 쓸지)와 근거(왜 다른지)를 섞지 않는 편이 CLAUDE.md 의 "Rationale 은 배경, 본문은 결론" 3섹션 원칙에 더 부합한다.
  - 제안: §4.4 본문에는 "순환 DI 해법은 2종 — forwardRef(구조적 순환 자체를 Nest DI 가 인지) / ModuleRef(strict:false)(생성자 @Optional 이 인스턴스화 순서로 undefined 되는 케이스의 런타임 지연 조회)"처럼 유형 구분을 먼저 제시한 뒤 각 사례를 나열. 상세 배경(왜 이 두 가지가 병존하는지, DI 순환 근본 축소를 안 하는 이유)은 `## Rationale`의 "C-1 god-class strangler-fig 분할" 인접 절에 위임하는 편이 기존 문서 관행(같은 문서 다른 절이 "결정 요약 → Rationale 상세 위임" 패턴을 일관되게 사용 — 예: line 1276 C-1·M-7, line 1280 WFI→failed)과 맞는다.

- **[INFO]** `getNotificationsService`/`getWebsocket` 두 선례 명명이 헬퍼 함수명 규약 문서에 없음
  - target 위치: 계획 항목2 서술 ("기존 `NotificationsService.getWebsocket()` 도 동일 선례")
  - 위반 규약: 해당 없음 — conventions 어디에도 "지연 해석 헬퍼는 `get<ServiceName>` 명명" 같은 명문 규칙이 없다.
  - 상세: 코드 확인 결과 두 헬퍼(`getNotificationsService`, `getWebsocket`)가 이미 `get<X>()` 패턴으로 일관되어 있고 문서화 대상은 이 명명 자체가 아니라 "왜 두 가지 해법이 쓰였는가"이므로 지적할 위반은 없음. 단, 향후 세 번째 사례가 추가될 경우를 대비해 conventions 화(예: `spec/conventions/` 에 소규모 규약 신설)를 고려할 수 있으나, 현재 2건뿐이라 개별 spec 문서(§4.4) 내 서술로 충분 — 규약 승격은 시기상조라는 점을 INFO 로만 남긴다.

- **[INFO]** `finalizeFailedExecution` 헬퍼 추출은 명명 규약·출력 포맷 규약에 영향 없음 (확인 결과, 위반 없음)
  - target 위치: 계획 항목1
  - 위반 규약: 없음
  - 상세: `runExecution` catch 블록과 `finalizeResumedExecutionOutcome`의 FAILED 종결 로직(status/error/save/`EXECUTION_FAILED` emit/`execution_failed` dispatch)을 private 헬퍼로 통합하는 순수 리팩터다. `EXECUTION_FAILED`(WS 이벤트 코드)·`execution_failed`(알림 타입, `spec/data-flow/8-notifications.md §1.1` 소관)는 기존 명명을 그대로 재사용하며 신규 식별자·API endpoint·에러 코드를 발행하지 않는다. `error-codes.md`(§1 의미 기반 명명), `node-output.md`(NodeHandlerOutput 5필드 계약) 어느 쪽과도 충돌 소지가 없다. behavior-preserving 이므로 `spec/conventions/migrations.md`(신규 마이그레이션 불요, §7.1 기존 컬럼 재사용 확인됨) 대상도 아니다.

- **[INFO]** frontmatter `status: partial` + `pending_plans` 정합 — 계획 반영 시 갱신 필요 여부만 확인 필요
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter (line 1-13)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 (status lifecycle)
  - 상세: 현재 `pending_plans`에 `execution-engine-residual-gaps.md`/`exec-intake-followups.md`/`exec-park-durable-resume.md` 3건이 등재되어 있다. `notif-followup-refactor.md`(본 작업의 실제 plan)는 이 목록에 없다 — 다만 이 작업은 §4.4 **문서화 갱신**(기존 코드의 사후 spec 반영)이며 `pending_plans`가 추적하는 "아직 구현되지 않은 약속"과 성격이 다르므로 등재 의무가 없다고 판단된다(§3 "partial: 일부 구현됨" — 이 작업 자체가 미구현 surface를 남기지 않음, behavior-preserving). 위반은 아니나, PR 병합 후 `notif-followup-refactor.md`가 `plan/complete/`로 이동할 때 계획 항목3("plan lifecycle: spec-update-notifications-background-run-id 의 마지막 §4.4 항목 완료 → complete 이동")이 실제로 수행되는지는 `--impl-done` 단계에서 재확인 필요.
  - 제안: 구현 완료 후 `spec-plan-completion.test.ts`(Gate C) 대상이므로, plan 완료 시 frontmatter `spec_impact`에 `spec/5-system/4-execution-engine.md`를 명시할 것.

## 요약

target 계획(§4.4 리팩터 + ModuleRef 지연 해석 패턴 문서화, finalizeFailedExecution 헬퍼 추출)은 정식 규약(error-codes.md, node-output.md, migrations.md, spec-impl-evidence.md) 어느 것도 직접 위반하지 않는다. 코드 조사 결과 `ExecutionEngineService.getNotificationsService()`(ModuleRef strict:false)와 `NotificationsService.getWebsocket()`(동일 패턴) 두 선례가 이미 구현·테스트돼 있어, 계획이 요구하는 것은 신규 패턴 도입이 아니라 기존 구현의 spec 반영(spec-impl-evidence 갭 해소)이다. 유일한 개선 여지는 문서 구조 측면 — §4.4 가 이미 "forwardRef 로 해결"이라는 단정적 결정문을 갖고 있어, ModuleRef 사례를 같은 문단에 이어붙이면 "결정 vs 예외 조건"의 경계가 흐려질 수 있으므로 선택 기준을 소제목/표로 분리해 서술하는 편이 문서 관행과 더 정합적이다(INFO). prompt payload 에 첨부된 conventions 발췌(cafe24-api-catalog)는 target 과 무관해 실제 판단에는 별도 조회한 관련 conventions 을 사용했다.

## 위험도

LOW
