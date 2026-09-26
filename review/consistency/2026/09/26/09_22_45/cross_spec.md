# Cross-Spec 일관성 검토 — `spec-draft-swagger-http-status-guard.md`

## 검토 범위

target(`plan/in-progress/spec-draft-swagger-http-status-guard.md`)이 `spec/conventions/swagger.md` 에
신설하는 §2-4 "광고 ↔ 실제 성공 코드" 규칙 + `code:` frontmatter 등재 + §5-4 체크리스트 항목 + Rationale 이,
`spec/5-system/2-api-convention.md`(§2.2 자원 액션 표 · §6 HTTP 상태 코드 표 · §5.4 검증 층) ·
`spec/conventions/spec-impl-evidence.md`(§2.1 `code:` 의미) · `spec/5-system/11-mcp-client.md` ·
`spec/2-navigation/4-integration.md`(§9.1 라우트 표) · `spec/2-navigation/9-user-profile.md`(§6.1 라우트 표)와
충돌하는지 대조했다.

## 발견사항

### [INFO] api-convention §6 표 ↔ swagger §2-4 신규 규칙의 단방향 참조

- target 위치: 변경 (2) — §2-4 표 아래 신설 문단 ("광고한 성공 코드는 실제 성공 코드를 담는다…")
- 충돌 대상: `spec/5-system/2-api-convention.md` §6 HTTP 상태 코드 표 (200/201/204 행)
- 상세: 모순은 아니다. `api-convention.md` 는 이미 여러 곳에서 swagger.md 로의 역참조 관례를 갖고 있다 —
  §5.2 목록 응답이 "메커니즘 상세: [Swagger 규약 §2-5 응답 wrapping]" 으로, §5.4 가 `nullable` 판단 근거를
  swagger §1-3/§1-4 로 역참조하는 식이다. 그런데 §6 표의 200/201/204 행은 "이 상태 코드가 실제 런타임 코드와
  짝을 이뤄야 한다"는 새 불변식이 생겼다는 사실을 전혀 가리키지 않는다. §6 표가 상태 코드를 고를 때 가장 먼저
  참조되는 자리이므로, 그 표만 읽는 다음 작성자는 "광고=실제" 강제가 별도 가드(`http-status-advertised`)로
  존재한다는 것을 모를 수 있다.
- 제안: 필수 사항은 아니나(target 의 Rationale "기각한 대안" 이 §6 을 "코드의 의미" 표로, swagger §2-4 를
  "문서-동작 짝" 규칙으로 명확히 분리하는 근거를 이미 제시했으므로 `code:` 등재까지 옮길 필요는 없다),
  `api-convention.md` §6 표의 200/201/204 행 또는 표 상단에 "실제 코드와의 일치는 [Swagger 규약 §2-4] 참조"
  한 줄을 덧붙이면 §5.2/§5.4 의 기존 상호 참조 관례와 일관돼 동기화 비용이 낮다.

### 확인됨 — 충돌 없음 (참고용, 조치 불요)

- **`code:` 단독 등재 결정의 선례 일치**: target 의 "기각한 대안 — api-convention 에도 적고 등재한다" 판단은
  `dto-class-name-collision*` 가드가 `swagger.md` 의 `code:` 에만 등재되고 `api-convention.md` 에는 등재되지
  않은 기존 선례와 형태가 같다(검토자가 두 파일의 `code:` 를 직접 diff 로 확인). `api-convention.md` §5.4 가
  "두 축을 시행하는 검증자는 양쪽에 등재한다"고 밝힌 원칙은 **한 가드가 두 문서에 각각 속한 축을 나눠 시행할
  때만** 적용되는데, `http-status-advertised` 는 단일 축(광고-실제 짝)만 시행하고 그 축은 swagger.md 소유라는
  target 의 논거와 모순되지 않는다.
- **선행 문서 텍스트와의 정합**: 구현 plan(`post-status-openapi.md`)이 지목한 두 자리 — `spec/5-system/11-mcp-client.md:537`
  (`preview-test` 실패 시 "HTTP 200 OK") · `spec/2-navigation/4-integration.md:843`
  (`:id/test` 의 `pending_install` 분기 "200 + { success:false, code:'INTEGRATION_INCOMPLETE' }") — 는 이미
  실제 코드가 아니라 **광고와 일치하는 200** 을 명시하고 있다. 즉 이 두 spec 문서는 target 이 강제하려는 "광고=실제"
  방향과 이미 일치하며, target 의 신설 규칙과 모순되는 다른 status code 서술은 없다.
- **workspaces 라우트 표**: `spec/2-navigation/9-user-profile.md` §6.1 은 `leave`·`transfer-ownership`·
  invitation 관련 엔드포인트를 메서드+경로+설명으로만 적고 명시적 HTTP status code 를 적지 않는다 — target 이
  이 14곳(과 `revokeInvitation`)의 실제 코드를 200 으로 맞추는 것과 충돌하는 문면이 없다.
- **요구사항 ID·데이터 모델·상태 전이·RBAC·계층 책임**: target 은 새 요구사항 ID·엔티티·상태 머신·권한 구조를
  전혀 도입하지 않는다(순수 문서-동작 대조 규칙). 새로 쓰는 식별자는 `http-status-advertised{-guard.ts,.spec.ts}`
  경로 문자열뿐이며 `spec/**` 전수에 기존 등장 0건(grep 확인) — naming collision 없음.
- **§2-4/§6 표 자체의 의미 정의**: 두 표 모두 200=조회/수정, 201=Created 로 일치하며 target 의 신설 문단은 그
  의미를 바꾸지 않고 "선택한 코드와 실제 코드가 같아야 한다"는 별도 축만 얹는다.

## 요약

target 이 `swagger.md` 에 적는 "광고 ↔ 실제 성공 코드" 규칙과 그 가드 `code:` 단독 등재 결정은 `api-convention.md`
§6/§5.4·`spec-impl-evidence.md` §2.1 의 기존 원칙(단일 축 가드는 그 축을 소유한 문서에만 등재) 및 기존
`dto-class-name-collision` 선례와 정합하며, 구현 plan 이 지목한 두 관련 spec 문서(`11-mcp-client.md`,
`4-integration.md`)의 기존 서술과도 모순되지 않는다(오히려 그 방향을 이미 선반영). 유일한 관찰은 `api-convention.md`
§6 표가 이 새 불변식으로의 역참조 링크를 아직 갖지 않는다는 점인데, 이는 계약 충돌이 아니라 기존 상호참조
관례와의 동기화 권장 사항(INFO)이다.

## 위험도
NONE
