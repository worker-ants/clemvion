# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/` (diff-base: origin/main)
검토 모드: impl-done

## 변경 범위 요약

`spec/5-system/` 내 실질 diff 는 `spec/5-system/1-auth.md` §2.3 세션 정책 "클라이언트 IP" 행 1줄 수정 뿐이다.

**변경 내용**:
- 기존: `req.ip`/`socket` 폴백을 포함한 4단계 IP 추출 순서를 단순 나열
- 변경: 해당 4단계 순서가 **세션·감사 IP 경로(`extractClientIp(req)`)에 한정**됨을 명시. webhook/rate-limit/`ip_whitelist` 경로는 `extractClientIpFromHeaders` 직접 호출로 `req.ip`/`socket` 폴백이 없음을 추가 기술. Rationale 2.3.B 참조를 유지.

## 발견사항

발견된 Rationale 연속성 위반 사항 없음.

변경 라인은 기존 Rationale 2.3.B ("클라이언트 IP 신뢰 (m-3)") 의 기록된 결정을 본문 표에 명문화한 것이다.

Rationale 2.3.B 는 다음을 명시하고 있다:
- `ip_whitelist`/rate-limit 의 IP 추출이 헤더 기반(CF-gated → XFF 첫 IP)인 것은 의도된 결정
- `req.ip`(Express `trust proxy 1`) 를 우선/대체로 쓰자는 안은 기각됨
- "코드 리뷰가 `req.ip` 폴백 부재를 지적하더라도 본 항이 정한 의도된 설계다"

새 body 텍스트는 정확히 이 결정을 §2.3 표에 노출한 것으로, 새로운 설계 선택을 도입하거나 기각된 대안을 재도입하지 않는다. `extractClientIpFromHeaders` 함수명 참조는 코드와의 정합을 높이는 구체화다.

## 요약

`spec/5-system/` 의 유일한 변경(1-auth.md §2.3 클라이언트 IP 행 확장)은 기존 Rationale 2.3.B 에 이미 확정된 "webhook/rate-limit/ip_whitelist 경로는 헤더 기반 IP 추출만, req.ip 폴백 기각" 결정을 본문 표에 동기화한 것이다. 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, 암묵적 invariant 우회 어느 항목도 해당하지 않는다. Rationale 연속성 관점에서 본 변경은 완전히 안전하다.

## 위험도

NONE
