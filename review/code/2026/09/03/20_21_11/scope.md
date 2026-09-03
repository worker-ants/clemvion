# 변경 범위(Scope) 리뷰

## 대상

`origin/main..HEAD` 범위의 커밋 2개:

- `9c120e6ae` — `WorkspaceInvitationDto.invitedBy` nullable 정정 (본 수정)
- `9e3d13f6b` — 직전 리뷰 1R(`20_02_03`) 지적 W1/W2/W3 조치 + 그 리뷰 산출물 커밋

## 발견사항

- **[INFO]** plan 문서에 "버그 수정"과 "축 전체 재검증(라이브 스키마 424컬럼 감사)" 두 관심사가 함께 묶여 있다
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:249`–`281` (`## 정본(라이브 스키마) 대조 — 축이 실제로 닫혔음을 확인` 절 전체)
  - 상세: 이번 커밋의 코드 변경분(`workspace-response.dto.ts`, `workspaces.controller.spec.ts`)은 `invitedBy` 단일 필드 정정에 정확히 국한돼 있다. 그러나 plan 문서에는 그와 별개로 배치 1~3 전체를 대상으로 한 `information_schema` 전수 대조(엔티티 컬럼 424개) 결과가 새 절로 추가돼 있다. 애플리케이션 코드는 건드리지 않고 문서에만 존재하며, 저자가 "부수" 로 명시해 은폐성 스코프 확장은 아니다. 직전 리뷰 라운드(`review/code/2026/09/03/20_02_03/SUMMARY.md` INFO#3)에서 이미 동일 관측이 나왔고 "조치 불요" 로 처리된 항목이 이번 diff 에도 그대로 남아 있다.
  - 제안: 조치 불요(기존 판단 유지). 다만 향후 유사 세션에서는 "단일 버그 수정" 과 "선행 배치 정본 재검증" 을 커밋 단위로 분리하는 편이 리뷰 diff 를 더 좁게 유지한다.

- **[INFO]** 직전 리뷰 라운드(`20_02_03`)의 산출물 13개 파일(`RESOLUTION.md`/`SUMMARY.md`/9개 reviewer 리포트/`meta.json`/`_retry_state.json`)이 이번 fix 커밋(`9e3d13f6b`)에 코드 수정과 함께 커밋됐다
  - 위치: `review/code/2026/09/03/20_02_03/*` (파일 5~17)
  - 상세: `review/**` 는 프로젝트 규약상 정식 저장 위치이고, "리뷰 산출물 + 그 지적에 대한 fix" 를 한 커밋에 묶는 것은 이 저장소의 기존 관례(예: 최근 로그의 `af1651264 fix(entity): 배치 3 리뷰 1R`, `2b1d4db6a docs(plan): 배치 3 리뷰 2R`)와 일치한다. 은폐나 무관한 파일 혼입이 아니라 워크플로가 요구하는 산출물이므로 결함으로 보지 않는다.
  - 제안: 조치 불요.

## 요약

핵심 코드 변경(`workspace-response.dto.ts` 필드 nullable 화 + import 추가, `workspaces.controller.spec.ts` 캐너리 테스트 2건 + 인자 검증 1줄)은 커밋 메시지가 서술한 "`invitedBy` nullable 정정" 범위에 정확히 국한돼 있고, drive-by 리팩토링·불필요한 포맷팅·무관한 임포트 정리·설정 변경은 관측되지 않았다. `CHANGELOG.md` 항목 추가는 직전 커밋(`af1651264`)이 스스로 세운 "OpenAPI 계약 변경 시 CHANGELOG 를 단다" 규칙을 뒤늦게 따른 것으로 범위 이탈이 아니라 자기 일관성 보정이다. plan 문서에 버그 수정과 별개인 "정본 스키마 424컬럼 감사" 절이 함께 실려 있는 점, 그리고 이전 리뷰 라운드 산출물이 같은 커밋에 실린 점 두 가지를 관측했으나 둘 다 문서/메타 영역에 국한되고 저자가 명시적으로 서술했으며 은폐성이 없어 위험도를 높이지 않는다.

## 위험도
NONE
