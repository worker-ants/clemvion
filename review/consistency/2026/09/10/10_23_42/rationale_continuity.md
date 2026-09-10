# Rationale 연속성 검토 — 배치 C (`spec-draft-doc-precision-batch-c.md`)

## 발견사항

없음. C-1~C-5 전 항목을 대상 spec 문서의 실제 `## Rationale` 원문과 대조했으나, 기각된 대안의
재도입·합의 원칙 위반·무근거 결정 번복·invariant 우회에 해당하는 사례를 찾지 못했다.

아래는 결론에 이르기까지 확인한 근거다 (발견사항이 아니라 검토 로그).

### C-1 — `1-data-model.md ## Rationale` 채택 행 하위 각주

- 실측(`spec/1-data-model.md:955-961`): 3행 표(`select: false` 기각 / DTO 단독 손질 기각 /
  응답 경계 투영+검출 2축 채택)가 그대로 있고 4행은 없다. target 의 재판정과 일치.
- 제안된 각주(*"채택안의 구현 형태는 쿼리 범위 `select` 투영이다"*)는 기각 행("컬럼
  `select: false` — 엔티티 전역, 내부 소비 경로가 값을 읽는 컬럼에 걸면 fail-silent")과
  채택 형태("그 쿼리 하나만 좁히는 옵션")를 **범위·성질**로 명확히 분리한다. 실측
  (`codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:92`)의
  `select: { creator: CREATOR_PROJECTION }` 은 `find`/`findOne` 옵션 — 엔티티 컬럼 선언이
  아니라 쿼리 단위 투영이라는 target 의 기술 설명과 정확히 일치한다.
- 이미 이 Rationale 항목 자체가 *"`select: false` 기각은 일반 규칙이 아니다 — 컬럼별 소비
  패턴이 가른다"* 는 조건부 문구를 갖고 있어(1-data-model.md:958-960), C-1 의 각주는 그
  조건부 원칙을 좁혀 재확인하는 것이지 뒤집는 것이 아니다. **원칙 위반·재도입 아님.**
- "별 행이 아니라 하위 각주로" 라는 편집 방식(4번째 열 추가 거부)은 저장소의 다른 곳에
  명문화된 규칙이 아니라 target 자신의 문서화 스타일 판단이다 — 이 판단이 기존 Rationale
  과 충돌하는 지점은 찾지 못했다(정보 손실 없이 조건을 좁히는 각주이므로 INFO 수준의
  스타일 선택으로 본다).

### C-2 — `notification_secret_v2` 저장 형태 명시

- 실측(`spec/conventions/secret-store.md:52-53`): *"grace 동안의 신규 secret 은
  `Trigger.notification_secret_v2` 컬럼에 **평문**으로 둔다"* 는 2026-09-05 결정이 이미
  존재한다. C-2 의 변경안은 이 기존 결정을 `1-data-model.md §2.8` 행에 **미러**하는 것이지
  새로 결정하는 것이 아니다.
- 자매 행 `chat_channel_token_v2` 의 성격 차이(reference vs plaintext)를 가리키는
  `spec/5-system/15-chat-channel.md#R-K`(640행)도 실재하며 인용 텍스트와 일치한다.
- `1-data-model.md ## Rationale` 의 "값을 읽는다 → 응답 경계에서 지운다" 표(958-960행)에도
  `Trigger.notification_secret_v2` 가 "값을 읽는" 사례로 이미 등재돼 있어, C-2 가 §2.8 에
  적으려는 서술과 방향이 일치한다. **결정 재도입·번복 아님 — 기존 결정의 미러링.**

### C-3 — `swagger.md` 인용 §1-3 → §1-3+§1-4 병기

- 실측(`spec/conventions/swagger.md:81-88`): §1-3 은 `@ApiPropertyOptional({ enum, default })`
  단일 예시뿐이며 `nullable`·키 생략 논의가 없다.
- 실측(`spec/conventions/swagger.md:105-116`): §1-4 블록쿼트가 `@ApiPropertyOptional` vs
  `@ApiProperty({ nullable: true })` 의 근거를 정확히 다루고, API 규약 §5.4 로 역방향
  링크를 건다.
- 실측(`spec/5-system/2-api-convention.md:228`): 현재 정방향 인용은 §1-3 단독.
- 이 항목은 서술을 뒤집는 것이 아니라 **누락된 인용 대상을 보완**하는 것이며, 어떤
  Rationale 도 "§1-3 단독 인용" 을 의도된 결정으로 명시한 바 없다. **번복 대상 자체가
  없음.**

### C-4 — 래칫 대조군 `code:` 등재 확장(1→6) + `production-build-devdep*` 비등재

- 실측(`spec/conventions/spec-impl-evidence.md:81`): *"넓은 트리 글롭으로 가드만 통과시키는
  것은 아무것도 가리키지 않는 것과 같다"* 문구가 실재하며, target 이 `fixtures/**` 대신
  소유 문서별 정밀 glob 을 쓰는 근거로 정확히 인용한다.
- 실측(`spec/5-system/3-error-handling.md:232-238`): §1.10 은 스스로 "정의·트리거 SoT 는
  2-trigger-list.md §3 이고 본 절은 공용 카탈로그 가시성 등재" 라 적는다 — 이는 §1.5~§1.9
  가 이미 쓰는 "도메인 spec 이 SoT, §1 카탈로그는 참조만" 패턴과 동형이며, C-4 가
  `2-trigger-list.md` 를 유일한 등재처로 정하고 `3-error-handling.md` 에 이중 등재하지 않는
  것은 이 기존 패턴을 **따르는** 것이지 위반이 아니다.
- 실측(`codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`,
  `endpoint-path-conflict-wrap.spec.ts`): 두 파일 모두 실재하며, 제안된
  glob(`endpoint-path-conflict-wrap*.ts`)은 `-guard` 접미사를 뺀 것이 맞다 — `#1299` 가
  기록한 "`-guard*` 는 2개 중 1개만 덮는다" 함정과 일치하는 회피이지, 그 함정을
  재도입하는 것이 아니다.
- `production-build-devdep*` 비등재 결정은 *spec-impl-evidence.md §2.1* 의 "시행 코드 없는
  순수 문서형 convention" 예외(반대 방향: 규약 문서 없는 시행 코드)를 억지로 확장하지
  않고 별도 트래커 항목으로 미루는 것으로, "억지로 주인을 만들면 관할을 카테고리째
  넓히게 된다" 는 자체 근거를 대며 명시적으로 결정을 유보한다 — **결정을 뒤집지 않고
  Rationale 성문화를 후속으로 명시 유보**한 형태라 "무근거 번복"에 해당하지 않는다.

### C-5 — `requestId` 예시 3곳 정본 UUID 통일

- 실측: `3-error-handling.md:265,284,475` 모두 `"req_abc123"`, `2-api-convention.md:175`·
  `12-webhook.md:302` 는 이미 `"f3b6d2e0-9d4a-4b77-9d19-7a0f8f4c1e2b"`. target 서술과 일치.
- `14-external-interaction-api.md:340` 의 `"3f2a…"` 는 target 이 명시적으로 **건드리지
  않는다**고 적고 그 이유(다른 형식이 아니라 줄임표 축약)를 남긴다 — 이는 EIA 문서의
  좁은 표 축약 관례를 존중하는 것이지 무시하는 것이 아니다.
- `requestId` 형식 선택에 대한 별도 Rationale 항목은 저장소 전체에 없다(grep 0건) — 되돌릴
  "결정"이 애초에 존재하지 않는 순수 오타 정합화다.

## 요약

배치 C 의 다섯 항목(C-1~C-5)은 모두 사실 정합·인용 정밀도를 좁히는 문서 정밀도 수정이며,
각 항목이 인용하거나 전제하는 기존 `## Rationale` 원문(1-data-model.md `select: false` 기각
근거, secret-store.md `notification_secret_v2` 평문 결정, swagger.md §1-3/§1-4 분리, 15-chat
-channel.md §R-K, error-handling.md §1.10 도메인-참조 패턴, spec-impl-evidence.md 의 "넓은
글롭 무효" 원칙)을 실제 파일에서 확인한 결과 모두 정확히 인용하고 있었고, 그 원칙을 어기거나
과거에 명시적으로 기각된 대안을 이유 없이 되살리는 지점은 없었다. C-4 가 등재 범위를
1개→6개로 넓힌 것과 `production-build-devdep*` 를 등재하지 않기로 한 것은 얼핏 "결정 변경"
처럼 보이지만, 둘 다 기존 규약 문구(spec-impl-evidence.md)를 근거로 명시하고 스스로 유보
사유를 남겨 두어 "새 Rationale 없는 번복"에 해당하지 않는다. Rationale 연속성 관점에서는
차단 사유가 없다.

## 위험도
NONE
