# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-chat-channel-conventions.md`

## 발견사항

- **[CRITICAL]** (a)의 실측이 "에러 응답 `details`"와 "감사 로그 `details`"를 혼동해 위반 건수에 넣었다
  - target 위치: `## (a) details 객체 형태에 code 를 빠뜨릴 수 있게 돼 있다` 실측 표 — `workspaces.service.ts | name · settings | 없음 (2곳)` 행
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3`("에러 응답" — `error.details`)과 `spec/conventions/audit-actions.md`(`AuditLog.details`)는 서로 다른 표면인데, target 이 후자를 전자의 위반 사례로 열거했다
  - 상세: `workspaces.service.ts:356`·`:428` 의 `details: { field: 'name' }` / `{ field: 'settings' }` 는 `throw` 되는 HTTP 에러 봉투가 아니라 **성공 처리 뒤 `auditLogsService.record({...})` 호출 인자**다(코드 확인 — 두 자리 모두 `renameWorkspace`/`updateWorkspaceSettings` 의 정상 완료 경로에서 감사 로그로 "무엇이 바뀌었는지"를 남긴다). `AuditLogsService.record` 의 시그니처는 `details?: Record<string, unknown>` 으로 완전 자유형이고 `audit-actions.md` 어디에도 `details.code` 요구가 없다. 반면 `2-api-convention.md §5.3` 의 "객체 `details: { field, code, … }`" 행은 **에러 응답 바디**에만 적용되는 형식이다. target 은 이 둘을 "서비스 가드가 던지는 `details: { field … }`" 라는 표면적 유사성(같은 `field` 키)만으로 같은 위반 클래스에 묶었다 — 실제로는 하나는 실패를 알리는 에러 사유, 다른 하나는 성공한 변경을 기록하는 감사 메타데이터다.
  - 제안: (a)의 실측 표에서 `workspaces.service.ts` 행을 제거하거나 "감사 로그 — 본 규약 적용 대상 아님"으로 재분류한다. D-1·D-4 및 후속 developer PR 체크리스트에 이 두 자리가 "배선 대상"으로 잘못 승계되지 않도록, 결정문에 "감사 로그 `details` 는 `2-api-convention §5.3` 적용 범위 밖"이라는 한 줄을 명시한다. `code: 'INVALID_FIELD'` 를 감사 로그 항목에 넣으면 "검증 실패"를 뜻하는 코드가 "성공적으로 완료된 변경" 기록에 붙어 감사 트레일의 의미가 깨진다.

- **[WARNING]** 같은 (a) 실측이 `triggers.service.ts` 내 실제 위반 사이트도 과소 집계했다
  - target 위치: 같은 실측 표 — `triggers.service.ts | type(schedule 거부) · botTokenRef · inboundSigningRef · inboundSigning · inboundSigningPlaintext ×4 · authConfigId | 없음 (9곳)`
  - 위반 규약: 표가 근거로 삼는 동일 규약(`2-api-convention.md §5.3` 객체 행)에 대한 자기 실측 정확성 — 이 표 자체가 발행 대상 자리를 지목하는 인벤토리로 쓰이므로 부정확하면 §5.4.1 3축 표(D-4)·후속 배선 PR 체크리스트가 실제 자리를 놓친다
  - 상세: 저장소를 grep 하면 `triggers.service.ts` 안에서 `details: { field: … }` 형태이면서 `code` 가 없는 자리는 최소 **13곳**이다 — target 이 열거한 9곳(`type`·`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`inboundSigningPlaintext ×4`·`authConfigId`) 외에 `botToken`(`triggers.service.ts:702`)·`chatChannel`(`:733`)·`provider`(`:744`) 세 자리가 빠졌고, `inboundSigningPlaintext` 는 4회가 아니라 **5회**(`:710,797,812,824,833`) 등장한다. 세 자리(`botToken`/`chatChannel`/`provider`) 는 공교롭게도 바로 이 저장소가 어제(`#1311`~`#1314`) PATCH 비밀-쓰기 차단으로 신설한 가드들이다 — `15-chat-channel.md §5.4.1`/`§5.4.1.2` 가 이미 그 정확한 자리를 "서비스 가드 → `code` 없음"으로 명시 서술하고 있는데(아래 두 번째 WARNING과 연결), target 의 (a) 실측이 그 자리들을 놓쳐 두 문서의 인벤토리가 어긋난다.
  - 제안: `grep -n "details: { field:" codebase/backend/src/modules/triggers/triggers.service.ts` 로 재실측해 표를 정정한다. 개수(9/11)를 결정문 본문(D-1)이 인용하지는 않으므로 D-1 자체의 유효성은 흔들리지 않지만, D-4 가 `15-chat-channel.md §5.4.1` 표를 "계약값"으로 갱신할 때 이 정정된 인벤토리를 함께 반영해야 다음 developer PR 이 자리를 다시 발견하는 재작업을 피한다.

- **[WARNING]** D-4 의 변경 범위가 `§5.4.1` 표만 지목하고, 동일 주장을 반복하는 `§5.4.1.2` 문단을 놓쳐 같은 파일 안에 상충하는 서술이 남는다
  - target 위치: `## 결정` D-4, `## 변경안` D1 행("`15-chat-channel.md §5.4.1` 3축 표 | `details[].code` 를 계약값으로 + 배선 PR 링크")
  - 위반 규약: `spec/5-system/15-chat-channel.md` 자신의 내부 정합성(같은 문서가 같은 사실에 대해 서로 다른 값을 말하면 안 된다) — `2-api-convention.md §5.3` 이 최종적으로 요구하는 형식과 동일 문서 내 다른 절의 서술이 갈리게 된다
  - 상세: `15-chat-channel.md §5.4.1.2`(`chatChannel` 필드 존재성 · `provider` 불변성)는 명시적으로 이렇게 적고 있다 — *"`details[].code` 는 두 항목 모두 **서비스 가드 갈래라 싣지 않는다**(위 §5.4.1 의 두-갈래 서술 참조)."* 이 문장은 D-1("details 객체에 code 는 생략하지 않는다")·D-4(§5.4.1 3축 표의 `code` 칸을 계약값 `INVALID_FIELD` 로 갱신)가 적용된 뒤에는 **같은 파일 안에서 거짓**이 된다 — §5.4.1 표는 이제 "계약: `INVALID_FIELD` (배선 대기)"라고 말하는데 바로 아래 §5.4.1.2 는 여전히 "싣지 않는다"고 말한다. target 의 변경안 표(A1/B1/C1/D1)에는 이 문단을 갱신하는 항목이 없다.
  - 제안: D-4 범위에 `§5.4.1.2` 의 해당 문장("두 항목 모두 서비스 가드 갈래라 싣지 않는다")을 명시적으로 포함해, §5.4.1 표와 동일한 톤("계약값 `INVALID_FIELD`, 배선 전까지는 관측값이 아니다")으로 갱신한다. 최소한 체크리스트에 "§5.4.1.2 동기화" 한 줄을 추가한다.

- **[INFO]** D-2(swagger.md 명명 규칙 신설) 의 삽입 위치가 문서 자체의 기존 하위번호 관행과 형식을 안 맞출 수 있다
  - target 위치: `## 변경안` B1 행 — "`conventions/swagger.md §1`"
  - 위반 규약: 강제 규칙은 아니나, `swagger.md §1) DTO 패턴`은 `1-1`~`1-6` 형태로 번호가 매겨진 하위섹션 + 필요 시 `> 근거: [§Rationale …]` 역링크로 일관되게 구성돼 있다(예: §1-4, §1-5, §1-6 모두 이 패턴)
  - 상세: target 은 "swagger.md §1 에 명명 규칙을 범위와 함께 적는다"고만 적어, 새 규칙이 `1-7` 같은 정식 하위섹션으로 들어갈지 §1 도입부 산문에 끼워질지 불명확하다. 기존 문서 관행상 신규 DTO 규칙은 번호 있는 하위섹션 + Rationale 역링크 형태를 취해왔다.
  - 제안: 실제 편집 시 `1-7. DTO/Update 접두 명명` 같은 번호 있는 소절로 신설하고, 필요하면 `## Rationale` 에 대응 근거 절을 추가해 기존 §1-4~§1-6 패턴과 형식을 맞춘다.

## 요약

target 은 세 결정(D-1 `details.code` 필수화 · D-2 DTO 명명 범위 · D-3 멱등성 각주) 모두 방향과 근거 대부분이 실제 코드·기존 spec 서술과 부합하며, 특히 (c) 항목은 `telegram.adapter.ts:73`·`#1313` 인용까지 정확하다. 그러나 핵심 근거인 (a)의 "실측" 표에 **범주 오류**(HTTP 에러 응답 `details` vs 감사 로그 `details` 를 같은 위반으로 묶음, CRITICAL 1건)와 **집계 누락**(triggers.service.ts 실제 위반 자리 3곳 + 카운트 오차, WARNING)이 있고, 이 (a) 실측이 그대로 두 spec 파일 위 서로 다른 절에 반영되면(D-1/D-4) `15-chat-channel.md` 안에서 §5.4.1 표와 §5.4.1.2 문단이 상충하는 상태로 남는다(WARNING). 세 건 모두 target 을 spec 에 반영하기 전에 정정 가능한 범위이며, D-1~D-3 의 정책 방향 자체를 뒤집을 근거는 아니다.

## 위험도

MEDIUM
