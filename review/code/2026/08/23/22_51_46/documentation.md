# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 미갱신 — 기존 "Unreleased" 항목이 이 PR 로 인해 거짓 서술이 됐다
  - 위치: `CHANGELOG.md:24-25` (해당 파일은 이번 diff 에 포함되지 않음 — 16개 변경 파일 목록에 없음)
  - 상세: `CHANGELOG.md` 최상단 "Unreleased — `nodeOutput` 이 deny-list 한 칸에 기대고 있었고, 엔진
    내부 필드가 새고 있었다" 항목(직전 PR #1205, commit `16f3e3625`)은 "**SSE·fanout 은 여전히
    deny-list(잔여)** 이고 정본 트래커에 별도 항목으로 등재돼 있다 — 즉 이 시점부터 REST 와 SSE 의
    `nodeOutput` 필터 강도가 다르다" 라고 명시적으로 적어 뒀다. 이번 PR 이 정확히 그 잔여 gap 을
    닫아 SSE/fanout 도 fail-closed allowlist 가 됐으므로, 이 문장은 이제 **사실과 다르다**. 그런데
    이 PR 의 diff 16개 파일 중 `CHANGELOG.md` 는 없다. 게다가 강한 선례가 있다 — 바로 이 직전 커밋
    `16f3e3625`(REST 쪽 같은 표면의 fix) 자신이 문서 리뷰에서 "같은 표면의 선례가 있는데 CHANGELOG
    를 빠뜨렸다"(W4) 로 지적받아 별도 fixup 커밋으로 CHANGELOG 를 추가했었다(`git show --stat
    16f3e3625` 에서 확인, 29줄 diff). 이번 SSE 확장은 그 선례와 **정확히 같은 성격**(보안 경계
    강화, REST/SSE 강도 통일)이라 같은 gap 이 재발할 위험이 크다.
  - 제안: `CHANGELOG.md` 상단 Unreleased 항목에 SSE/fanout 도 fail-closed 로 닫혔다는 새 절을
    추가하거나, 기존 "SSE·fanout 은 여전히 deny-list(잔여)" 문장을 이 저장소의 자기반증형 소정정
    관례(취소선 + 정정문)로 갱신할 것. `spec/5-system/14-external-interaction-api.md` §R17 에는
    이미 이 정정이 반영돼 있으므로(diff 파일 15), CHANGELOG 만 뒤처졌다.

- **[INFO]** `node-output-allowlist.ts` 파일 헤더 주석의 예시 문장이 새 소비처(SSE)를 반영하지 못함
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:15`
  - 상세: 같은 블록 상단(3~12줄, 이번 diff 로 갱신)은 "소비처는 둘이다 — EIA REST `getStatus` 와
    WS `toFanoutEnvelope`" 라고 정정했는데, 바로 아래 15줄은 "두 정책(deny-list/allowlist)의 관계
    … `getStatus` 는 둘 다 지난다" 로 여전히 `getStatus` 만 예로 든다. 실제로 이제
    `toFanoutEnvelope` 도 `stripExternalOnlyFields` → `allowlistNodeOutputKeys` 순으로 둘 다
    지난다(`websocket.service.ts` diff, `toFanoutEnvelope` 본문). 틀린 서술은 아니지만(예시로서
    `getStatus` 도 여전히 유효한 사례) 방금 갱신한 윗문단과 톤이 어긋난다.
  - 제안: "`getStatus`·`toFanoutEnvelope` 는 둘 다 지난다" 로 갱신하거나, 상단 문단이 이미 두
    소비처를 설명하므로 이 문장 자체를 제거.

## 잘된 점 (참고)

- `NODE_OUTPUT_ALLOWED_KEYS` JSDoc 의 그룹 표가 3그룹(`핸들러 계약 공개분`/`wire 전용(위젯)`/
  `wire 전용(chat-channel)`)으로 이미 동기화돼 있고 `spec/5-system/15-chat-channel.md` 를 SoT 로
  인용한다 — consistency-check(`22_26_33`)가 잡은 WARNING 3이 이 diff 시점엔 이미 반영된 상태.
- 정본 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)의 "wire-only 4키"
  항목이 8키로 갱신됐고, 반증된 전제(호출부 4곳 → 실은 1개 chokepoint)를 취소선으로 남기고
  `<details>` 로 이력을 보존하는 방식이 이 저장소의 자기반증형 소정정 관례를 정확히 따른다.
  `spec/5-system/14-external-interaction-api.md` §R17 표도 같은 방식(취소선 + 정정)으로 갱신됨.
  `spec/5-system/6-websocket-protocol.md` §4.4 blockquote 에도 "`nodeOutput` 키 집합은 공유하지
  않는다" 단서가 추가돼 WS/EIA 양쪽 SoT 가 상호 정합.
  `spec/5-system/14-external-interaction-api.md` §R17 blockquote 에 `nodeOutput.nodeType` vs
  `waitingNodeType`, `nodeOutput.payload` vs webhook 봉투 `payload` 의 동명 필드 disambiguation
  각주도 추가돼 naming_collision WARNING 5·6 이 반영된 상태.
- 신규 함수 `allowlistFanoutNodeOutput`·갱신된 `toFanoutEnvelope` JSDoc 이 "왜"(chokepoint 근거,
  copy-on-change 근거, 내부 WS 비영향 근거)를 전부 설명하고 근거를 실측(`_retryState` 실재)으로
  뒷받침한다. 신규 테스트(`websocket.service.spec.ts`, `node-output-allowlist.spec.ts`) 도 각
  캐너리 앞에 왜 이 케이스가 필요한지(예: "넷 중 하나만" 재발 방지, fixture 파생 vacuous 방지)를
  JSDoc/주석으로 설명해 테스트 자체가 문서 역할을 겸한다.
- `swagger.md` 는 `nodeOutput` 을 이미 "진짜 열린 map"(DTO 비고정)으로 규정하고 있어, 이번
  allowlist 확장이 OpenAPI 문서 갱신을 요구하지 않는다(확인 완료, 별도 조치 불필요).

## 요약

코드·spec·plan·JSDoc·주석 간 정합성은 이례적으로 높다 — consistency-check(`22_26_33`)가 잡은
JSDoc 표 stale·트래커 4→8키·naming disambiguation WARNING 들이 이 diff 시점엔 이미 전부
반영돼 있고, 자기반증형 소정정 관례(취소선 보존)도 spec·plan·코드 주석 세 층 모두에서 일관되게
지켜졌다. 유일한 실질 갭은 `CHANGELOG.md` 미갱신이다 — 직전 PR(#1205)의 Unreleased 항목이 "SSE는
여전히 deny-list" 라고 못박아 뒀는데 이번 PR 이 그걸 뒤집었고, 같은 성격의 갭을 직전 PR 자신이
이미 한 번 지적받고 고친 선례가 있다. INFO 항목 1건(예시 문장 불완전)은 사소하다.

## 위험도
LOW
