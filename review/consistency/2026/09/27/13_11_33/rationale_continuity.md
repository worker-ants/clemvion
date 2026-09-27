# Rationale 연속성 검토 — spec/2-navigation/ (--impl-prep)

## 검토 범위 및 한계

- 전달된 번들 중 본문이 실제로 포함된 파일: `spec/2-navigation/1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md` (target 전 18개 파일 중 3개), 그리고 관련 spec 의 `## Rationale` 발췌: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/3-workflow-editor/{0-canvas,2-edge,3-execution,4-ai-assistant}.md`, `spec/4-nodes/{0-overview,1-logic/9-foreach}.md`.
- `spec/2-navigation/` 의 나머지 15개 파일(`4-integration.md`, `5-knowledge-base.md`, `6-config.md`, `8-marketplace.md`, `9-user-profile.md`, `_product-overview.md`, `0-dashboard.md`, `7-statistics.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `14-execution-history.md`, `15-system-status.md`, `16-agent-memory.md`, `_layout.md`)와 그 외 다수 관련 spec 의 Rationale 은 컨텍스트 예산 초과로 프롬프트에서 절단됐다. 이 절단은 "해당 파일에 문제가 없다" 는 근거가 아니며, 이 보고서는 **본문이 실제로 주어진 3개 파일 + 위 Rationale 발췌 범위**에 한정된 결론이다.

## 발견사항

- **[WARNING]** 이미 해소된 파라미터 불일치를 여전히 "현재 진행 중"으로 서술하는 stale 경고
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.3 필터 표, "상태" 행 (`⚠️ **현재 클라이언트는 서버 계약과 어긋난 파라미터를 보낸다** — 아래 경고 참고`)
  - 과거 결정 출처: 같은 문서 §2.3 바로 아래 보강 문구("상태 필터는 서버 계약(`query-workflow.dto.ts`)·클라이언트(`page.tsx`) 모두 `?status=active|inactive` 로 정렬되어 end-to-end 동작한다 — 과거 클라이언트가 `?isActive=` 를 보내던 불일치는 수정 완료") — 이 보강 문구는 커밋 `af7effe673` (2026-06-10, `#519`) 에서 "클라이언트 수정이 필요하다" 던 이전 경고문을 대체하며 들어갔다.
  - 상세: `git blame` 확인 결과 "상태" 행의 `⚠️ 현재 클라이언트는 서버 계약과 어긋난 파라미터를 보낸다` 문구는 2026-06-03 커밋(`cfffc13554`)에서 도입된 뒤, 4일 뒤(2026-06-06 기준 기록 시점 아님, 실제로는 2026-06-10) 불일치가 수정되고 그 사실을 알리는 보강 문구가 새로 쓰였음에도 **표 행의 문구 자체는 갱신되지 않았다**. 그 결과 지금 문서는 같은 절 안에서 "현재 어긋난 파라미터를 보낸다"(불일치 존재)와 "end-to-end 로 동작한다 · 불일치는 수정 완료"(불일치 해소)를 동시에 주장하는 자기모순 상태로 3개월 이상 방치돼 있다. 이 자체는 과거 Rationale 을 뒤집는 새 설계 도입은 아니지만, `--impl-prep` 검토자가 이 절을 읽으면 "아직 고쳐야 할 상태 필터 버그가 있다"고 오판해 이미 끝난 수정을 다시 시도하거나, 반대로 실제로 남아 있는 문제를 무시할 위험이 있다.
  - 제안: `1-workflow-list.md` §2.3 "상태" 행의 경고 문구를 보강 문구와 정합하도록 제거하거나 "과거 불일치가 있었으나 수정 완료(§2.3 하단 참고)"로 축약한다. 별도 Rationale 항목을 새로 만들 필요는 없다 — 이미 하단 문구가 그 역할을 하고 있으므로, 표 행과 하단 문구 중복을 정리하는 것으로 충분하다.

## 요약

본문이 실제로 제공된 세 파일(`1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md`)은 Rationale 연속성 측면에서 전반적으로 매우 잘 관리되고 있다. 태그 필터 단일화(§4), Import permissive 정책(§2), 폴더 계층 무결성(§3), "공유" 정의(§1) 등 과거 결정은 모두 본문에서 명시적으로 Rationale 을 역참조하며, 특히 트리거 문서의 R-2(Webhook HMAC 회전안)는 폐기 사실을 취소선 + "정정" 박스로 남기고 R-14 로 대체함을 명시하는 등 거부된 대안의 재도입을 막는 모범적인 패턴을 보인다. R-4/R-16(`isActive` 단일 PATCH 경로 vs drawer UI 표현 분리), R-17("이 캐너리는 계약이 아니라 구현을 고정한다")도 과거 결정과 현재 서술의 경계를 스스로 정확히 긋고 있어 뚜렷한 CRITICAL 급 위반(기각된 대안의 무단 재도입, invariant 우회)은 발견되지 않았다. 유일하게 지적할 사항은 `1-workflow-list.md` §2.3 의 상태 필터 행에 3개월 전 해소된 불일치를 여전히 미해결로 서술하는 stale 경고가 남아 있는 것으로, Rationale 반전 자체보다는 "결정은 내려졌으나 그 결정이 본문 전체에 일관되게 반영되지 않은" 사례에 가깝다. 다만 `spec/2-navigation/` 의 15개 파일과 다수 관련 spec 의 Rationale 이 컨텍스트 절단으로 검토되지 못했으므로, 이 결론은 검토된 범위에 한정된다.

## 위험도

LOW
