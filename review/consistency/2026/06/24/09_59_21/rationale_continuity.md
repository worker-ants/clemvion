# Rationale 연속성 검토 결과

검토 범위: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
검토 대상 spec: 0-dashboard.md, 1-workflow-list.md, 10-auth-flow.md, 11-error-empty-states.md, 13-user-guide.md, 14-execution-history.md, 15-system-status.md, 16-agent-memory.md, 2-trigger-list.md

---

## 발견사항

- **[INFO]** 대시보드 Success Rate 분모 — spec-vs-code sync 근거 기록 완비
  - target 위치: `spec/2-navigation/0-dashboard.md §3 / ## Rationale "Success Rate 분모 = 7일 전체 실행 건수"`
  - 과거 결정 출처: 동 파일 `## Rationale` 첫 번째 항목
  - 상세: 초기 spec 초안의 "completed+failed 분모" 정의를 "7일 전체 실행 건수"로 번복했으나, Rationale 에 코드 현실 반영 근거("구현을 SoT 로 채택하고 spec 을 맞췄다"), 번복 이유("최근 활동 대비 성공 비율" 의미), 미채택 대안의 재활성화 경로("구현 변경 필요")를 명시해 두었다. Rationale 형식은 충분하다.
  - 제안: 이슈 없음. 현 상태 유지.

- **[INFO]** Avg Time 카드 미노출 — 합의 근거 문서화 완비
  - target 위치: `spec/2-navigation/0-dashboard.md §2/§3 / ## Rationale "Avg Time 카드 미노출"`
  - 과거 결정 출처: 동 파일 `## Rationale` 두 번째 항목
  - 상세: 초기 초안의 Avg Time 카드 노출을 폐기하면서 Rationale 에 코드 현실(`avgExecutionTime` 은 응답에 포함되나 별도 카드로 시각화하지 않음)을 명시했다. 기각된 대안(초기 Avg Time 카드 노출)의 번복이 정당하게 문서화되어 있다.
  - 제안: 이슈 없음. 현 상태 유지.

- **[INFO]** "공유 워크플로우" 정의 — 기각된 (b) 대안의 내용이 §2.3 소유 필터에 부분 반영
  - target 위치: `spec/2-navigation/1-workflow-list.md §2.3 소유 필터 / ## Rationale §1`
  - 과거 결정 출처: 동 파일 `## Rationale §1 "공유 워크플로우의 정의 — 팀 워크스페이스 전체"`
  - 상세: Rationale 은 (a) "팀 워크스페이스에 속한 모든 워크플로우 = 공유"를 채택하고 (b) "`createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼" 을 폐기했다. 그런데 §2.3 소유 필터의 "공유된 워크플로우 = `createdBy ≠ 현재 사용자`"는 기각된 (b) 의 createdBy 비교 로직을 필터 레이어에서 재사용하고 있다. Rationale 은 "뱃지(a)와 필터(b-createdBy 기준 세분화)가 역할 분담"이라고 설명하며 이 공존을 의도적인 것으로 기술한다. 의도된 공존이므로 Rationale 위반은 아니나, (b) 의 기각 범위가 "뱃지 수준에서의 공유 정의"에 한정됨을 명시했으면 혼동이 없을 것이다.
  - 제안: `## Rationale §1` 에 "(b) 는 뱃지 단위의 공유 정의에서 기각된 것이며, 필터의 작성자 구분에는 동일 개념이 소유 필터로서 채택되어 있음"을 한 줄 추가하면 차후 혼동을 방지할 수 있다.

- **[INFO]** Import permissive config 정책 — config(soft) vs 구조(hard) 분리 원칙 명문화
  - target 위치: `spec/2-navigation/1-workflow-list.md §3.2 Import / ## Rationale §2`
  - 과거 결정 출처: 동 파일 `## Rationale §2 "Import 의 permissive config 정책"`
  - 상세: Rationale 이 "config 내용(soft) vs 구조(hard)" 분리 원칙을 명시하고, 이를 기반으로 노드 타입 화이트리스트·라벨 UNIQUE 는 hard-fail, config parse 실패는 permissive 처리하는 결정을 정당화한다. 합의된 invariant 와 충돌하지 않는다.
  - 제안: 이슈 없음.

- **[INFO]** OAuth 콜백 — access token URL 미탑재 원칙 준수
  - target 위치: `spec/2-navigation/10-auth-flow.md §5.3 OAuth 콜백 처리 상세`
  - 과거 결정 출처: 동 파일 §5.3 "(decision A, 2026-05-31 — URL history/Referer/프록시 로그 노출 차단)"
  - 상세: "access token 은 URL 에 싣지 않는다"는 보안 결정이 인라인 참조(decision A)로 기록되어 있다. 이 결정은 Rationale 절이 아닌 본문 주석으로만 남아 있어, 향후 URL 리다이렉트 패턴을 재도입하는 PR 에서 과거 기각 이유가 눈에 덜 띌 수 있다.
  - 제안: `## Rationale` 에 "R-OAuth-A. 콜백에서 access token URL 미탑재" 항목을 추가하고 "(decision A, 2026-05-31)" 내용을 이관하면 Rationale 연속성이 강화된다.

- **[INFO]** 에러 페이지 403 CTA 목적지 변경 — Rationale 문서화 완비
  - target 위치: `spec/2-navigation/11-error-empty-states.md §1.2 / ## Rationale "403 CTA 목적지 — 대시보드"`
  - 과거 결정 출처: 동 파일 `## Rationale` 첫 번째 항목
  - 상세: 초기 §1.2 가 "워크스페이스 선택 화면"으로 정의했던 403 CTA를 "대시보드"로 번복하면서, Rationale 에 미구현 surface(워크스페이스 선택 화면), 향후 재갱신 경로를 명시했다. 결정 번복이 적절히 문서화되어 있다.
  - 제안: 이슈 없음.

- **[INFO]** 실행 내역 목록 API `sort` 기본값 — 도메인 오버라이드 명시
  - target 위치: `spec/2-navigation/14-execution-history.md §5 API 쿼리 파라미터 sort`
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §4.1` (기본값 예시 `created_at`)와의 차이를 §5 테이블 각주에서 "의도된 도메인 오버라이드"로 명시
  - 상세: API 규약의 기본 정렬 축(`created_at`)과 다른 `started_at`을 사용하면서, spec 내 각주에 "의도된 도메인 오버라이드"임을 밝혔다. 합의된 규약을 무시한 것이 아니라 인식 후 오버라이드한 것이며, 그 근거도 명시되어 있다.
  - 제안: 이슈 없음.

- **[INFO]** LLM 탭 평탄화 — 기존 "단일 LLM Information 탭 + 하위 탭" 구조 번복 근거 완비
  - target 위치: `spec/2-navigation/14-execution-history.md §3.4.2 / ## Rationale R-3`
  - 과거 결정 출처: 동 파일 `## Rationale R-3 "LLM 탭을 단일 LLM Information 탭에서 최상위 평탄화로 바꾼 이유"`
  - 상세: 이전 구조(단일 LLM Information → 하위 탭)를 최상위 평탄화로 번복하면서, 사용성 근거(멀티턴 타임라인에서 탭 두 번 진입 문제, 실패 진단 빈도)를 Rationale 에 명시했다. 합의된 구조의 번복이 정당하게 기록되어 있다.
  - 제안: 이슈 없음.

- **[INFO]** 시스템 상태 화면 — 갱신 방식 분리(수동 vs 자동 폴링) Rationale 완비
  - target 위치: `spec/2-navigation/15-system-status.md / ## Rationale R-1`
  - 과거 결정 출처: 동 파일 `## Rationale R-1 "통계 화면과 공유하는 것 / 다른 것"`
  - 상세: 통계 화면(수동/필터 refetch) 패턴을 기반으로 하되 갱신 방식을 의도적으로 다르게 정의하면서 그 이유(status 성격 → 자동 폴링)를 Rationale 에 명시했다. 합의 원칙 위반 없음.
  - 제안: 이슈 없음.

- **[INFO]** Agent Memory 화면 — 삭제 권한 경계(editor+) Rationale 완비
  - target 위치: `spec/2-navigation/16-agent-memory.md / ## Rationale`
  - 과거 결정 출처: 동 파일 `## Rationale` (조회는 viewer+, 삭제는 editor+)
  - 상세: "삭제는 비가역(hard delete)"을 근거로 editor+ 권한 제한을 정당화했으며, 동일한 제약 패턴이 통합/지식저장소에도 적용됨을 명시해 선례 일관성을 확보했다. Invariant 위반 없음.
  - 제안: 이슈 없음.

---

## 요약

`spec/2-navigation/` 영역 전반에서 기각된 대안의 재도입이나 합의된 invariant 직접 위반 사례는 발견되지 않았다. 대부분의 spec 문서가 번복·변경 결정마다 `## Rationale` 항목을 갱신해 두었으며, 과거 결정과의 연속성이 잘 유지되어 있다. 경미한 개선 여지가 두 곳에서 확인되었다: (1) `1-workflow-list.md §1` 에서 기각된 (b) 대안의 createdBy 비교가 필터 레이어에서 재사용됨을 Rationale 에 명시적으로 구분해 두면 차후 혼동을 방지할 수 있고, (2) `10-auth-flow.md` 의 "access token URL 미탑재" 보안 결정(decision A)이 본문 인라인 주석으로만 남아 있어 `## Rationale` 절로 이관하면 연속성 가시성이 향상된다. 두 사항 모두 INFO 수준이며 현행 합의 원칙을 위반하지는 않는다.

---

## 위험도

LOW
