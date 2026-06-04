# Code Review (1차 — router misfire) 요약

⚠️ **router 가 변경을 "spec 문서만"으로 오판해 코드 reviewer 8명을 skip**, Phase A spec 만
리뷰됨(database reviewer 조차 "DB 코드 변경 없음"이라 V071 마이그레이션 미인지). C-1
Critical("17-agent-memory.md 초안 수준")은 완성 파일에 대한 주관적 오판(FP).
→ **코드 범위 재스코프 + --route all 로 재리뷰**(세션 23_xx). 본 1차 결과는 spec 보완 참고용.

## 코드에 적용할 실질 보안 발견 (재리뷰로 이월)
- W-1 memoryKey→scope_key: 파라미터 바인딩(이미 적용)+ 길이상한/검증 필요.
- W-2/I-3 indirect prompt injection: 회수 content·추출 content 를 systemPrompt 주입 전
  untrusted 로 wrap(=[user-input] 마커) 필요.
- W-3 workspace_id 격리: 서비스 public 메서드 필수 파라미터(이미 적용)+ invariant 테스트.

## spec 보완(소규모, 별도 반영)
W-4/W-7/W-8/W-9(dead anchor)/W-10(AGM product-overview)/W-11/12/13, I-11(SPEC-DRIFT §7 v3).
