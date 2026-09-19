# 정식 규약 준수 검토 — SMTP SSRF/CGNAT 가드 (impl-done, scope=spec/4-nodes/4-integration/)

## 검토 범위 요약

- spec 델타: `spec/4-nodes/4-integration/` 0개 파일 (정상 — 코드 전용 변경)
- 구현 diff: 14개 파일 / 696줄. 핵심: `http-safety.ts` 에 IPv4-mapped IPv6 판정 추가 + `SsrfBlockedError` 클래스 도입, `common/utils/smtp-host-guard.ts` → `nodes/integration/send-email/smtp-host-guard.ts` 로 재구현 이전(구현체를 `ssrf.util` 기반에서 `http-safety.ts`(`assertSafeOutboundHostResolved`) 기반으로 교체), e2e/unit 테스트 확충, `.env.example`·user-guide mdx 문구 갱신.
- 검토는 `spec/conventions/**`(error-codes.md · node-output.md · egress-masking.md · spec-impl-evidence.md · review-citations.md 등) 대비 명명·출력 포맷·문서 구조·API 문서·금지 패턴 5축을 확인했다.

## 발견사항

- **[WARNING] 신설 `smtp-host-guard.ts` 가 자신이 속한 노드 spec 의 `code:` 증거 목록에 없음**
  - target 위치: `spec/4-nodes/4-integration/3-send-email.md` frontmatter `code:` (현재 `send-email.handler.ts` · `send-email.schema.ts` 2개만 등재)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의("본 spec 이 약속한 surface 의 구현 경로") 및 R-1(글로브·경로 완결성의 취지)
  - 상세: 이번 diff 로 `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` 가 **send-email 노드 자신의 디렉터리 안**에 신설됐다(종전엔 `common/utils/smtp-host-guard.ts` 로 노드 밖 공용 위치였다). spec 본문(§4 step 7, §8.0)은 이미 "SMTP SSRF 가드" 를 노드의 핵심 계약으로 서술하는데, 그 구현 파일이 이제 노드 전용 폴더에 물리적으로 속함에도 `code:` 목록엔 없다. `spec-code-paths.test.ts` 가드는 "≥1 매치" 만 요구하므로(기존 2개 파일이 이미 매치) 이 diff 가 build 를 깨뜨리진 않지만, `1-http-request.md` 가 자신의 `http-safety.ts` 를 `code:` 에 등재해 놓은 것과 비교하면 send-email 만 비대칭적으로 자기 SSRF 구현 파일을 누락한 상태가 된다.
  - 제안: `3-send-email.md` frontmatter `code:` 에 `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` 를 추가한다(developer 가 spec 본문을 바꾸지 않고 `code:` 목록만 넓히는 것이므로 자기-반증형 소정정 예외 조항과 무관하게 통상 `--impl-done` 스코프 안에서 반영 가능한 사소한 갱신에 해당). 다음 planner/consistency 턴에서 반영 권장.

- **[INFO] 공유 SSRF 구현(`http-safety.ts`)이 Database Query · Send Email 두 spec 의 `code:` 에 여전히 미등재 — 이미 알려진 부채**
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md`, `3-send-email.md` frontmatter `code:`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (참고 규약, hard violation 아님)
  - 상세: `http-safety.ts` 는 DB Query·Send Email 이 의존하는 SSRF 판정 로직의 실제 SoT 이지만, 물리적으로 `http-request/` 폴더에 있어 두 노드의 `code:` 어디에도 등재되지 않는다. 이번 diff 는 이 상태를 새로 만든 것이 아니라(이전부터 그랬음) 그대로 물려받았고, `http-safety.ts` 자신의 JSDoc 이 "공용인데 http-request/ 폴더에 있는 이유" 를 명시하고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 이관을 이미 등재해 뒀다(코드 코멘트에서 직접 확인). 즉 이미 인지되고 추적 중인 부채이므로 이 리뷰에서 새 CRITICAL/WARNING 으로 재-flag 하지 않는다 — 참고용으로만 남긴다.
  - 제안: 별도 조치 불필요. 위 트래커 항목이 실행될 때 두 spec 의 `code:` 도 함께 갱신하면 된다.

- **[INFO] 에러 코드·명명·메시지 마스킹은 모두 기존 규약을 그대로 따름 — 위반 없음 확인**
  - target 위치: `codebase/backend/src/nodes/integration/http-request/http-safety.ts`(`SsrfBlockedError`), `.../send-email/smtp-host-guard.ts`
  - 상세(양성 확인, 조치 불요): (1) `output.error.code` 로 surface 되는 값은 여전히 기존 `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` 뿐이고 이 diff 는 이 값들을 새로 만들거나 바꾸지 않았다 — `error-codes.md` §1(의미 기반 명명)·§2(rename 금지) 위반 없음. (2) 신설 `SsrfBlockedError` 는 `extends Error` + `this.name = 'ClassName'` 패턴으로 기존 `IntegrationError`(`integration-handler-base.ts`)와 동일한 관용구를 따른다. (3) `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 가 던지는 `SsrfBlockedError` 메시지는 hostname/IP 를 포함하지만 이는 **서버 로그 전용**이고, 클라이언트로 나가는 `output.error.message`/`testEmailTransport` 의 반환 메시지는 계속 일반화 문구("Request blocked by SSRF policy." / "SMTP host points to a private/loopback address blocked by policy.")를 쓴다 — `1-http-request.md §8.3`(정찰 면 축소 결정)·`egress-masking.md`("차단 문구에 대상 주소를 싣지 않는다") 취지와 정합. (4) `http-safety.ts`/`smtp-host-guard.ts` 의 "egress" 용어 사용은 egress-masking.md 가 스스로 구분해 둔 "네트워크 egress 방화벽(SSRF 가드)" 도메인과 일치하며 payload-마스킹 "egress" 와 혼동하지 않는다.

## 요약

이번 diff(SMTP SSRF 가드를 `http-safety.ts` 공용 구현으로 통합 + IPv4-mapped IPv6/CGNAT 판정 확장)는 명명(에러 코드·클래스), 출력 포맷(클라이언트 메시지 일반화·서버 로그 분리), 금지 패턴(과거 폐기된 `ssrf.util` 기반 구현으로의 회귀 없음) 축에서 기존 정식 규약과 잘 정합한다. 유일한 실질적 지적은 `spec-impl-evidence.md` 관점의 문서 완결성 — 새로 노드 전용 폴더에 들어온 `smtp-host-guard.ts` 가 `3-send-email.md` 의 `code:` 증거 목록에 아직 없다는 점이며, 이는 build 게이트를 막지 않는 소프트 갭이다(WARNING 1건). 공유 `http-safety.ts` 의 cross-node `code:` 누락은 이미 트래커로 추적 중인 기존 부채라 이 리뷰에서는 정보성으로만 남긴다.

## 위험도

LOW
