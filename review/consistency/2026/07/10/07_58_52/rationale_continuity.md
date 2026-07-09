# Rationale 연속성 검토 결과

대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` (--impl-prep, scope=spec/5-system/)

## 발견사항

없음 — CRITICAL/WARNING 급 Rationale 연속성 위반을 찾지 못했다.

교차 검증한 주요 지점 (모두 기존 Rationale 과 정합):

- `1-auth.md` §2.3 "비밀번호 변경 시 세션 revoke" 는 Rationale 2.3.C 의 채택안(옵션 B: 전체 family revoke + 현재 디바이스 즉시 재발급)과 일치하며, 명시적으로 기각된 대안 (a) "재발급 없음 전체 revoke", (b') "현재 family 제외 revoke" 는 재도입되지 않았다.
- §2.3 Refresh 쿠키 `SameSite` 기본값 `none` 은 Rationale 2.3.B 의 채택 결론과 일치하고, 기각된 원안("기본 Lax + cross-site 만 opt-in")이 재도입되지 않았다.
- §2.3 클라이언트 IP 신뢰 정책(`extractClientIp` req.ip 폴백 vs `extractClientIpFromHeaders` 헤더 전용)의 경로별 분리는 Rationale 2.3.B 가 명시적으로 "기각" 처리한 "`req.ip` 우선/대체" 안을 다시 채택하지 않았다.
- §1.1.B 이메일 변경 재인증에서 이메일 OTP 를 배제한 것은 Rationale 1.1.B-4 와 일치하며, 동일 문서 §2.3 강제 세션종료 재인증에는 이메일 OTP 가 남아있는 것에 대해 1.1.B-4 가 "§2.3 정의 자체는 변경하지 않는다"고 명시적으로 경계를 그어두어 표면적 모순이 실제로는 해소되어 있다.
- §1.4.2 "WebAuthn 우선·TOTP 자동 fallback 금지"는 Rationale 1.4.D 와 일치.
- §1.4.4 counter 역행 시 credential 삭제(suspend 미채택)는 Rationale 1.4.E 와 일치.
- §1.5 초대 토큰 raw 저장(vs 이메일 인증/재설정 토큰의 SHA-256 해시)은 Rationale 1.5.D 가 위협모델 차이로 명시적으로 정당화한 그대로다.
- §1.5.4 `lower_snake_case` 초대 에러코드는 `spec/conventions/error-codes.md §3` historical-artifact 레지스트리와 상호 참조가 일치하며, §2 rename 정책("이름 정확성만을 위한 rename 금지")과 충돌하지 않는다(이미 배포된 wire contract이므로 rename 자체를 하지 않는 방향).
- §4.1.A "Planned 감사 액션 dot-prefix 통일" 은 아직 `AUDIT_ACTIONS` 미등재(미구현)라 error-codes.md §2 의 "배포된 코드 rename 금지" 정책 대상이 아니며, `conventions/audit-actions.md` 가 동일 결정을 SoT 위임으로 상호 참조하고 있어 정합적이다.
- `10-graph-rag.md` 의 "KB 모드는 생성 시에만 결정, 사후 변경 불가"(§2.1/§2.2/요구사항 KB-GR-MD-02/기술결정표/Rationale 결정6)는 본문·Rationale 전체에서 반복 재확인되며 예외 없이 일관된다.
- `10-graph-rag.md` §8 비-목표(community detection·Neo4j·prompt override 등 P2+)는 `spec/0-overview.md §6.3` 로드맵에 실제로 미러링되어 있음을 확인했다 — `2-navigation/14-execution-history.md` Rationale 이 "저장소 선례(Graph RAG)"로 인용한 관행이 실제로 지켜지고 있다.

## 요약

`spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 는 모두 성숙도가 높고 각 결정 지점마다 촘촘한 `## Rationale` 항목(기각된 대안 명시 포함)을 갖추고 있다. 본문을 Rationale 각 항목과 대조한 결과, 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 사례는 발견되지 않았다. 다만 이번 --impl-prep 호출의 실제 작업 대상(plan: `expression-enricher-dry`, spec_area: `spec/5-system/5-expression-language.md`, 순수 프론트엔드 내부 리팩터)과 이번에 전달된 target 문서(`1-auth.md`, `10-graph-rag.md`)가 주제상 무관해 보인다는 점은 참고 정보로 남긴다(Rationale 연속성 결함이 아니라 scope 선정 이슈로, 이 리뷰의 판단 범위 밖).

## 위험도
NONE
