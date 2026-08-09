# Rationale 연속성 검토 — `plan/in-progress/spec-draft-auth-invariants-sync.md`

## 발견사항

- **[INFO]** "부트 fail-closed 가드마다 1-auth.md 에 동반 기록" 이라는 일반화가 단일 선례에 근거
  - target 위치: `## 5. 부트 캐너리 설계 근거` §"위치 근거" (target 문서 257~261번째 줄 부근, "이 저장소는 부트 fail-closed 가드마다 `1-auth.md ## Rationale` 에 동반 기록을 지켜 왔다 — 기존 `### Production fail-closed 가드 …` 가 그 선례다")
  - 과거 결정 출처: `spec/5-system/1-auth.md ## Rationale` §"Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP"(유일한 선례) vs. `spec/5-system/14-external-interaction-api.md ## Rationale` §"부팅 정책"(`TerminalRevokeReconcilerService.onModuleInit` 의 scheduler 등록 실패 시 fail-fast — 서버 부팅 차단)이 **자기 도메인 spec 에** 기록되어 있음
  - 상세: 실제 저장소 관행은 "부트 fail-closed 가드는 전부 `1-auth.md` 에 모인다" 가 아니라 "해당 가드가 속한 도메인 spec 의 Rationale 에 기록한다" 에 가깝다(EIA 큐의 boot fail-fast 는 `14-external-interaction-api.md` 에 있지, `1-auth.md` 에 없음). target 의 문구는 이 카운터이그잼플과 배치되는 과잉 일반화이나, 정작 target 이 이 문구로 정당화하려는 **배치 결정 자체**(`@WorkspaceId()` reflection 캐너리를 `1-auth.md` 에 두는 것)는 이 가드가 auth/워크스페이스 인가 도메인에 속하므로 "선례" 문구 없이도 독립적으로 타당하다. 즉 결론(배치)은 맞고 근거 서술(일반화 문구)만 과장됨 — 설계 충돌이 아니라 정확성 이슈.
  - 제안: "이 저장소는 부트 fail-closed 가드마다 …" 를 "이 저장소는 **auth/보안 크로스커팅** 부트 fail-closed 가드를 `1-auth.md ## Rationale` 에 모아 왔다(선례: Production fail-closed 가드) — 도메인 특정 boot 가드(예: EIA 큐 scheduler fail-fast)는 각 도메인 spec 에 남긴다" 정도로 한정해 정확성을 높이는 것을 권장(선택 사항, 배치 결론 자체는 변경 불필요).

## 요약

target 문서(`spec-draft-auth-invariants-sync.md`)는 5건 모두 "이미 결정·구현·머지된 것의 사후 기록"이라는 스스로의 전제를 실제로 지키고 있다. 검증 결과: (1) 항목 1의 `VALIDATION_ERROR` 재사용은 `2-api-convention.md`/`3-error-handling.md ## Rationale` 이 이미 정한 "도메인 특화 한도가 있을 때만 신규 코드, 그 외는 전역 코드 재사용" 원칙과 정합하며, 실제로 `#1108` 관련 plan(`auth-guard-reflection-hardening.md`)이 같은 근거로 `spec_impact: none` 을 유지했던 이력이 그대로 남아 있어 사실관계도 일치한다. (2) 항목 5의 부트 캐너리 설계에서 target 은 `data-flow/12-workspace.md ## Rationale` §"멤버십 검증은 가드 1곳에서"가 **이미 명시적으로 기각한** "라우트별 `@Roles`/opt-in 마커" 패턴("74번째 라우트에서 같은 누락이 재발한다")을 정확히 인용하며 **그 기각을 되돌리지 않는 것**(reflection 자가검증이라는 구조적으로 다른 접근)을 스스로 확인·기록하고 있다 — 이는 바로 이 checker 가 찾아야 할 위반의 정반대(모범) 사례다. (3) 항목 4(UUID 검증 강도 비대칭)는 신규 설계 결정이지만 target 이 직접 새 `## Rationale` subsection 을 작성해 "결정의 무근거 번복" 문제를 회피했고, 오히려 "일관성 명목으로 헤더를 조이는 것은 회귀"라며 향후 있을 수 있는 잘못된 "수정" 시도를 선제적으로 차단해 두었다. (4) 항목 4/5 는 착수 중 스스로 발견한 사실 오류(캐너리로 지목된 e2e 가 실제로는 그 술어에 닿지 않음)를 "결정 변경이 아니라 사실 정정"이라고 명확히 구분해 기록했다 — 결정(비대칭은 의도)과 근거(403→400 뒤바뀜)는 그대로 유지되므로 무근거 번복이 아니다. 발견된 유일한 이슈는 항목 5의 배치 근거 문구가 반례(EIA 큐 도메인 boot 가드가 자기 도메인 spec 에 기록됨)를 무시한 과잉 일반화라는 정확성 지적(INFO)뿐이며, target 이 실제로 내리는 배치 결정 자체에는 영향이 없다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 CRITICAL/WARNING 수준으로 발견되지 않았다.

## 위험도

LOW
