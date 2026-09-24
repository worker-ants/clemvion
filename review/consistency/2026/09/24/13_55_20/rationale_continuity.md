# Rationale 연속성 검토 — spec/5-system (--impl-prep)

## 범위와 방법

- target: `spec/5-system` 전체(`--impl-prep`). 컨텍스트 예산상 번들에는
  `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 본문 전체가 실렸고,
  나머지 15개 파일(`4-execution-engine.md`~`17-agent-memory.md`,
  `_product-overview.md`)은 **의도된 절단**으로 본문이 빠졌다(각 파일 표지만 확인).
- 대조 자료로 함께 제공된 `## Rationale` 발췌: `spec/0-overview.md`,
  `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`,
  `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md`,
  그리고 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 자신의
  `## Rationale` 절.
- 본문 전체가 실린 세 파일 전문 + 위 Rationale 발췌 전문을 통독하고, (1) 기각된
  대안의 재도입, (2) 합의 원칙 위반, (3) 무근거 번복, (4) invariant 우회 네
  관점으로 교차 대조했다. 아울러 최근 병합 이력(`fc56873be`·`33caa750c`,
  `removeMember` 권한 순서/owner 승격 가드)이 `1-auth.md` §3.2 각주("Admin 멤버
  삭제는 대상이 Owner 인 경우 거부")와 충돌하는지 커밋 diff로 직접 확인했다.

## 발견사항

이번 회차에서 CRITICAL/WARNING 급 Rationale 연속성 위반은 찾지 못했다. 통독한
범위(§1 인증, §2 API 규약, §3 에러 처리) 안에서는 본문이 도입하는 규칙마다
예외 없이 대응하는 `## Rationale` 항목이 있고, 과거 결정을 뒤집은 자리는
전부 명시적 정정 이력(취소선 + "정정"/"폐기 — X로 대체"/"이 근거는 틀렸다"
같은 라벨)을 달고 있었다. 확인한 주요 사례:

- **1-auth.md §2.3 SameSite 기본값 `none`**: Rationale 2.3.B가 "기본 `Lax` +
  cross-site 배포만 `none` opt-in" 원안을 실사용 데이터로 기각하고 `none`
  기본을 채택한 이력이 있는데, 본문이 그 기각된 원안(`Lax` 기본)으로 되돌아가지
  않았다 — 정합.
- **1-auth.md §2.3 클라이언트 IP 신뢰**: Rationale 2.3.B가 "`req.ip` 를
  우선/대체로 쓰자" 는 안을 명시적으로 기각했는데, 본문(§2.3 표)도 헤더 기반
  4단계 순서를 그대로 유지하고 있다 — 재도입 없음.
- **1-auth.md §1.4.4 WebAuthn counter 역행 처리**: Rationale 1.4.E가 "suspend"
  대안을 기각하고 "즉시 삭제" 를 채택했는데, 본문도 삭제로 일관 — 정합.
- **1-auth.md §3.2 각주(Admin 멤버 삭제 vs 대상 Owner)**: 가장 최근 병합
  (`fc56873be`, `33caa750c`, 2026-09-24)이 `removeMember` 의 인가 순서·owner
  승격 TOCTOU 를 고쳤으나, 두 커밋 모두 커밋 본문에 "spec 변경 없음 — 이
  spec 이 이미 규정한 대로다" 를 실측 근거와 함께 명시했고, 실제로 §3.2
  각주("대상이 Owner 인 경우 거부", "자기 자신 제거는 leaveWorkspace 로
  위임")는 두 수정 후 동작과 여전히 부합한다 — drift 없음.
- **2-api-convention.md §5.4 부재 표현 규칙**: `conversationThread` 를 `null`
  로 정규화하지 않는 이유가 규칙의 근거 사례로 명시적으로 남아 있고, 본문
  선례 표도 그 예외를 일관되게 반영한다.
- **3-error-handling.md `ACCOUNT_LOCKED`**: 카탈로그가 한때 423 이었던 오기를
  실측(`git log -S`)으로 401 정정한 이력이 있고, 현재 §1.2 테이블은 401 로만
  등재되어 있어(423 잔존 0건) 번복이 깨끗하게 완결돼 있다.
- **trigger-list.md R-2 (webhook HMAC secret 회전)**: R-14 로 대체된 설계를
  삭제하지 않고 취소선 + "폐기 — R-14 로 대체" 로 명시 보존한 모범 사례 —
  15-chat-channel.md R-CC-10 이 대조군으로 인용하는 이유까지 남겨 둬 향후
  삭제 압력에도 근거가 유지되게 해 뒀다.

### INFO — 절단된 15개 파일은 이번 회차에서 미검증

- target 위치: `spec/5-system/4-execution-engine.md`,
  `6-websocket-protocol.md`, `14-external-interaction-api.md`,
  `15-chat-channel.md` 등 컨텍스트 예산으로 본문이 빠진 15개 파일.
- 과거 결정 출처: 없음(검증 자체를 못 함) — 다만 번들에 포함된 발췌들이 이
  파일들의 특정 Rationale 항목(예: `4-execution-engine.md` "per-node →
  execution-level intake 큐", `15-chat-channel.md` R-CC-10·R-CC-19·R-CC-21·
  R-CC-22·R-CC-23)을 계속 참조하고 있다.
- 상세: 이번 리뷰는 이 15개 파일 **본문**의 기각된 대안 재도입 여부를 확인하지
  못했다. "여기 없다는 사실을 없다는 근거로 삼지 말 것" 이라는 번들 자체의
  경고를 그대로 승계한다.
- 제안: 이번 --impl-prep 대상 작업이 실제로 저 15개 파일 중 하나를 건드릴
  예정이라면, 그 파일만 좁혀서 별도 라운드로 Rationale 연속성을 재확인할 것을
  권한다. 이번 판정(NONE~LOW)은 실제로 통독한 3개 파일(§1~§3)에 한정된다.

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 는 이미
수십 차례의 `--impl-done`/`--spec` 교차 검토를 거치며 모든 번복 지점에 명시적
정정 이력(실측 근거·기각 사유·대체 Rationale 번호)을 남기는 관행이 정착돼
있다. 가장 최근 병합된 workspace 멤버 제거 관련 두 커밋도 spec 을 건드리지
않았고 그 판단(§3.2 각주와 정합)이 커밋 본문에 실측으로 기록돼 있어, 이번
회차에서 새로 드러난 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant
우회는 없었다. 다만 컨텍스트 예산으로 본문이 절단된 15개 파일은 이번 패스가
보지 못했으므로, 그 파일들을 직접 건드리는 후속 작업이 있다면 별도 좁은
범위 재검토가 필요하다.

## 위험도

NONE
