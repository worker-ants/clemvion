# 미완 기능 구현 로드맵

> 배경: PRD의 Phase 표기를 구현 상태로 갱신하면서 파악된 **미완 항목**을 11개 stage로 분리해 순차 구현한다. 각 stage는 독립적으로 배포 가능해야 하며, 완료 시 TEST WORKFLOW와 REVIEW WORKFLOW를 거친다.

## Stage 순서와 의존성

| # | Stage | 의존성 | 예상 범위 |
|---|-------|-------|-----------|
| 1 | [LLM 토큰 사용량 추적](../complete/feature-roadmap/01-llm-token-usage.md) ✅ | 없음 | backend 작음·frontend 작음 |
| 2 | [Parallel 노드](../complete/feature-roadmap/02-parallel-node.md) ✅ | 없음 | backend 작음 |
| 3 | [Background 노드](../complete/feature-roadmap/03-background-node.md) ✅ | 2(선택) | backend 중간 |
| 4 | [팀 워크스페이스 UI](../complete/feature-roadmap/04-team-workspace-ui.md) ✅ | 없음 (backend 모듈 존재) | backend 중간·frontend 큼 |
| 5 | [RBAC 가드](../complete/feature-roadmap/05-rbac-enforcement.md) ✅ | 4 | backend 큼·frontend 중간 |
| 6 | [2FA](../complete/feature-roadmap/06-2fa.md) ✅ | 없음 | backend 중간·frontend 중간 |
| 7 | [조직 레벨 Integration 공유](../complete/feature-roadmap/07-org-integration-sharing.md) ✅ | 4, 5 | backend 작음·frontend 작음 |
| 8 | [OpenTelemetry 트레이싱](../complete/feature-roadmap/08-otel-tracing.md) ✅ | 없음 | backend 중간·인프라 |
| 9 | [알림 임계값](../complete/feature-roadmap/09-alerting-thresholds.md) ✅ | 없음 | backend 중간·frontend 작음 (평가기 5분 cron 포함) |
| 10 | [접근성 (WCAG AA)](./stages/10-a11y.md) 🚧 | 없음 | frontend 큼 |
| 11 | [매뉴얼 검색](../complete/feature-roadmap/11-docs-search.md) ✅ | 없음 | frontend 작음 |

## 공통 원칙

- 각 stage는 **별도의 논리적 커밋 단위**. 같은 세션에서 여러 stage를 순차 구현하더라도, stage 간 변경은 논리적으로 분리.
- **SDD/TDD** 준수: 스펙 갱신 → 테스트 작성 → 구현 → 재테스트 → REVIEW.
- **TEST WORKFLOW**: `npm run lint` → `npm test` → `npm run build` (backend는 `npm run build` + `npm run test`).
- **REVIEW WORKFLOW**: 각 stage 종료 시 `ai-review` 스킬 실행, Warning 이상 이슈 처리, `review/**/RESOLUTION.md` 작성.
- **PRD/스펙 갱신**: 각 stage에서 관련 `prd/*.md`, `spec/**.md`의 상태 표기를 `🚧` 또는 `❌` → `✅`로 전환.
- **매뉴얼 동기화**: 사용자 노출 기능이 추가되면 `frontend/src/content/docs/`의 해당 페이지를 업데이트.

## 완료 정의 (Definition of Done)

- [ ] 스펙·PRD가 실제 구현과 일치
- [ ] 단위·통합 테스트 추가
- [ ] lint / test / build 전부 통과
- [ ] 관련 매뉴얼 페이지 갱신
- [ ] ai-review 결과의 Critical·Warning 해소
- [ ] RESOLUTION.md 작성(리뷰 수행 시)
