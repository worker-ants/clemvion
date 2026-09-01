# 유지보수성(Maintainability) 리뷰

## 검토 방법

이 changeset 은 이미 6라운드에 걸쳐 maintainability 를 포함한 리뷰를 받았고(각 라운드
`review/code/2026/09/01/{14_31_12,15_10_38,15_25_56,15_49_24,16_29_11,16_53_16}/maintainability.md`),
직전 라운드(6R, `16_53_16`)가 "수렴한다"로 판정했다. 이번 7라운드에서는 과거 판정을 그대로
받아쓰지 않고, 핵심 코드 파일 8개(`audit-logs.service.ts`/`.spec.ts`,
`auth-configs.service.ts`, `business-metrics.service.ts`/`.spec.ts`,
`audit-action-binding-{guard,fixture,spec}.ts`)를 저장소에서 직접 다시 열어 실측했다. 나머지
프롬프트 대상 파일(`review/code/**`, `review/consistency/**`, `plan/**`)은 실행되는 코드가
아니라 프로세스 산출물·계획 문서이므로 이 관점(가독성/네이밍/함수 길이/중첩/매직넘버/중복/
복잡도/일관성)의 대상이 아니다.

> **작업 트리 이상 상태 보고 (내가 만든 것 아님).** 이 리뷰를 쓰는 도중 `git status --short` 로
> 확인한 결과 `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 가 커밋되지 않은
> 채 수정되어 있었다 — 생성자의 `@Optional() private readonly metrics?: BusinessMetricsService`
> 가 `private readonly metrics: BusinessMetricsService`(옵셔널 제거)로 바뀐 상태다. 이 변경은
> `review/code/2026/09/01/16_29_11/RESOLUTION.md` 가 기록한 **Y2 뮤턴트("`@Optional` 제거 →
> DI 조립 실패해야 함")와 정확히 일치**해, 병렬로 도는 다른 reviewer 의 뮤테이션 검증 작업 중인
> 산출물로 보인다. 이 파일은 내가 건드리지 않았고, 원인 불명 상태를 이 파일에 대해 되돌리는
> 것도 다른 reviewer 의 진행 중인 검증을 방해할 수 있어 **복원을 시도하지 않았다.** 본 리뷰의
> 모든 판단은 `Read` 로 처음 연 시점의 원본 내용(`@Optional()` 유지된 버전 — 프롬프트의 diff와
> 일치)을 기준으로 했다. 다음 사람은 이 잔여물을 진짜 회귀로 오인하지 않도록 유의할 것.

## 발견사항

없음 — 신규 결함을 찾지 못했다. 과거 라운드가 이미 지적하고 조치·유예를 확정한 항목들을
재확인한 결과:

- **[INFO, 재확인]** `business-metrics.service.ts:179` (`recordAuditWriteFailed` JSDoc "왜
  클램핑인가" 절)의 한 줄이 158자로 인접 줄(~100자) 대비 눈에 띄게 길다. 5라운드
  (`16_29_11/maintainability.md`)가 이미 지적했고 조치 우선순위 낮음으로 판정된 채 그대로
  남아 있다 — 기능 영향 없는 순수 가독성 사안이라 재차단 사유 아님.
- **[INFO, 재확인]** `audit-logs.spec.ts:202,223,239` 세 신규 테스트가 `:154` 의 `build()`
  헬퍼를 쓰지 않고 `repo`/`service` 조립을 인라인 반복한다. 각 테스트가 `metrics` mock 의
  동작(던지는 mock·provider 부재·인자 자체 생략)이 서로 달라 `build()` 시그니처를 그대로
  재사용할 수 없는 의도적 트레이드오프다(5라운드 확인). 재확인 결과 여전히 유효.
- **[INFO, 재확인]** `audit-action-binding-guard.ts` 의 `extractActionType`(:162)과
  `extractBoundResourceText`(:247)가 "파라미터 첫 인자의 TypeLiteral 을 순회해 `action`
  프로퍼티를 찾는다"는 순회 골격을 공유한다. 각자 다른 것을 반환(타입 텍스트 전체 vs
  제네릭 인자만)하고 fixture 가 divergence 를 잡고 있어(6라운드 확인), 추출하면 얇은 래퍼
  둘로 나뉘는 수준 — 우선순위 판단으로 미조치 유지가 타당하다.

이 세 항목 모두 **"문서화됐기 때문"이 아니라 "우선순위 판단"으로 미조치**임이 6라운드
RESOLUTION 에 명시적으로 구분되어 있다(이 PR 초반 라운드에서 "이미 문서화됨"이라는 거짓
근거로 실재 결함을 두 라운드 덮은 전례가 있었던 것과 대비된다). 세 항목 모두 코드 동작에
영향이 없는 가독성/중복 수준이라 CRITICAL/WARNING 으로 격상할 근거가 없다.

추가로 직접 대조한 결과 확인된 것(신규 발견 아님, 건전성 재확인):

- `auth-configs.service.ts` 의 형제 4개 helper(`triggers`·`workflows`·`schedules`·
  `model-config`)는 전부 이미 `AuditActionFor<typeof X_RESOURCE_TYPE>` 형태이고, 이번
  changeset 이 `auth-configs` 하나만 같은 형태로 맞췄다 — 일관성 위반 없음.
- `AuthConfigsService.recordAudit` 호출부 5곳(create/update/regenerate/remove/reveal)이
  모두 named-params 로 동일한 형태를 따른다 — 중복 패턴 없음.
- fixture 파일(`audit-action-binding-fixture.ts`)의 "형태 N" 주석 번호가 1~6 으로 유일하다
  (6라운드가 고친 중복 라벨링이 유지되고 있음).
- `business-metrics.service.spec.ts` 의 `recordAuditWriteFailed`/`recordRedisFailOpen` 테스트
  블록 앞 JSDoc 이 각각 자신의 바로 아래 `it` 를 정확히 설명한다(2라운드가 고친 주석-대상
  귀속 오류가 재발하지 않았음).

## 요약

핵심 변경(감사 적재 실패 관측성 추가, `auth_config` `recordAudit` 타입 바인딩 수정, AST 기반
`audit-action-binding` 정적 가드 신설)은 유지보수성 관점에서 양호한 상태로 수렴해 있다. 함수는
짧고 단일 책임(`clampLabel`, `auditHelperParams`, `extractActionType`,
`findUnboundHelpers`/`findMisboundHelpers`/`normalizeResource` 등)이며 중첩 깊이도 얕다.
`PROMETHEUS_LABEL_MAX_LEN` 상수화는 기존에 두 곳에 흩어져 있던 매직넘버(`64`)를 제거한
개선이다. 네이밍은 도메인 의도를 잘 드러내고, 신규 가드는 형제 가드
(`engine-error-code-anchor-guard.ts`)와 동일한 파서/소비 spec 분리 컨벤션을 따라 기존 스타일과
일관적이다. 6라운드에 걸친 반복 리뷰 과정에서 실제로 발생했던 결함들(주석-대상 귀속 끊김,
무테스트 구현, 화살표 함수 필드 사각지대, 접두 문자열만 보는 얕은 바인딩 판정)은 모두 그
자리에서 뮤테이션 검증을 동반해 닫혔고, 이번 재검토에서 회귀나 새 결함은 발견되지 않았다.
남은 항목은 전부 이미 우선순위 판단으로 명시 처분된 INFO 수준(긴 JSDoc 한 줄, 테스트 헬퍼
재사용 부분적 누락, 두 추출 함수의 얕은 구조적 유사성)이며 차단 사유가 되지 않는다.

## 위험도
NONE
