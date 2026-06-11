# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/` 전체 (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-11

---

## 발견사항

### [INFO] `spec/2-navigation/14-execution-history.md` 에 Rationale 섹션 부재

- target 위치: `spec/2-navigation/14-execution-history.md` 전체 (§3.4.2)
- 과거 결정 출처: 파일 내 §3.4.2 본문 서술 — "이전에는 단일 `LLM Information` 탭 아래 `Response / Request / Usage` 하위 탭 구조였으나, 메시지를 선택할 때의 두 번 클릭 불편을 없애기 위해 평탄화되었다."
- 상세: `execution-history.md` 에는 `## Rationale` 섹션이 존재하지 않는다. LLM 탭 구조 변경(하위 탭 구조 → 평탄화)이라는 명시적 설계 번복이 본문에 인라인으로만 기록되어 있으며, 왜 하위 탭 구조가 처음에 선택됐고 무엇이 번복을 유발했는지의 대안 비교·채택 근거가 Rationale 절로 분리되어 있지 않다. 현재 구조는 기술 부채가 아닌 의도적 설계 전환임에도, 재방문하는 기여자가 이 결정의 배경을 확인할 경로가 없다.
- 제안: `## Rationale` 섹션을 신설하고, "하위 탭 구조(폐기) vs. 평탄화(채택)" 결정 근거(두 번 클릭 불편 제거)를 ADR 형태로 기록한다. 다른 설계 결정(N+1 회피 배치 집계 컬럼 선택, Re-run chain drill-down, Skipped 노드 제외 등)도 함께 수록할 수 있다.

---

### [INFO] `spec/2-navigation/2-trigger-list.md` — R-1~R-16 Rationale 일부 번호 불연속

- target 위치: `spec/2-navigation/2-trigger-list.md` `## Rationale` 섹션
- 과거 결정 출처: 동일 파일 Rationale 섹션
- 상세: R-1, R-2, R-3, R-4, R-5, R-6, R-7, R-8, R-12, R-13, R-14, R-15, R-16 이 존재하지만 R-9, R-10, R-11 항목이 누락되어 있다. 본문에서 R-9~R-11 을 참조하는 링크는 없어 현재 단절이 기능적 문제를 일으키지는 않으나, 번호 공백이 삭제된 항목인지 계획된 미작성 항목인지 알 수 없다.
- 제안: 번호 공백이 의도된 삭제라면 남은 항목들을 연속 번호로 재매핑하거나, 삭제 근거를 주석으로 남겨 재방문 시 혼란을 방지한다.

---

## 요약

`spec/2-navigation/` 내 검토 대상 파일들 전체에서 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, 시스템 invariant 우회에 해당하는 사항은 발견되지 않았다. 주요 Rationale 결정들 — 성공률 분모 채택(0-dashboard), 공유 정의 (b) 폐기 및 permissive import 정책(1-workflow-list), `/toggle` 미채택 및 `workflowId` v1 잠금(2-trigger-list), OAuth 콜백에서 access token URL 미노출(10-auth-flow), drill-down 미제공(15-system-status), 별도 화면 채택(16-agent-memory) — 이 모두 본문 설계와 정합한다. 단순 개선 사항으로는 `14-execution-history.md` 에 Rationale 섹션이 없어 LLM 탭 평탄화 결정의 배경이 인라인 주석으로만 남아 있다는 점, 그리고 `2-trigger-list.md` Rationale 번호에 R-9~R-11 공백이 있다는 점이 확인됐다. 두 사항 모두 기능적 일관성을 깨지는 않으며 추후 문서 정리 시 보완하면 충분하다.

## 위험도

LOW
