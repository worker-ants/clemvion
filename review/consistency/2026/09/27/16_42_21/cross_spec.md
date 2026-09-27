# Cross-Spec 일관성 검토 — patch-body-followups (impl-done)

## 검토 범위 확인

- 선언 scope `spec/2-navigation/` 델타: 0개 파일 (정상 — 이 브랜치는 spec 을 바꾸지 않았다, `spec_impact: none`).
- 구현 diff: `codebase/backend` 11개 파일 — `UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist` 세 요청 필드에 `nullable: true` + `T | null` 타입을 추가해 OpenAPI 선언을 기존 런타임 동작(“null 을 보내면 값을 지운다”)에 맞춘 것. 동작 변화 없음, 선언만 정정. 나머지는 대응 테스트(unit/e2e)·헬퍼 JSDoc·CHANGELOG.
- 대조한 spec: `spec/5-system/2-api-convention.md` §5.4(PATCH tri-state 요청 바디 예외 조항), `spec/1-data-model.md` §2.4 Workflow · §2.6 Node · §2.17 AuthConfig(컬럼 nullable 여부), `spec/2-navigation/1-workflow-list.md`(scope 대상, `description`/Export 언급), `spec/2-navigation/6-config.md`(scope 밖이나 같은 코드를 소유 — IP Whitelist UI/API 서술), `spec/3-workflow-editor/1-node-common.md`(같은 코드를 소유하는 scope 밖 spec — node `description` 서술 유무).

## 발견사항

없음 — 대조한 범위에서 CRITICAL/WARNING/INFO 급 충돌을 찾지 못했다.

교차검증 근거:

1. **데이터 모델 충돌 없음** — `spec/1-data-model.md` §2.4 `Workflow.description: String?`, §2.6 `Node.description: String?`, §2.17 `AuthConfig.ip_whitelist: String[]?` 모두 이미 nullable 로 정의돼 있다. 이번 diff 는 OpenAPI 선언을 이 데이터 모델과 일치시킨 것이지, 새로운 nullable 성을 도입한 것이 아니다.
2. **API 계약 충돌 없음, 오히려 기존 규약의 명시 사례** — `spec/5-system/2-api-convention.md` §5.4 는 "적용 범위 — 응답 바디" 이며 "요청 바디는 대상이 아니다"라고 명시하면서, PATCH 부분 업데이트의 키 생략(불변)/`null`(초기화)/값(설정) tri-state 를 위해 요청 DTO 에서 `@ApiPropertyOptional({ nullable: true }) + field?: T | null` 조합이 "정당하다"고 선례(`UpdateAssistantSessionDto.llmConfigId`)까지 들어 서술한다. 이번 diff 의 세 필드 변경은 이 조항이 이미 허용·권장하는 패턴을 그대로 따른 것이다.
3. **요구사항 ID 충돌 없음** — 새 요구사항 ID 부여 없음.
4. **상태 전이 충돌 없음** — 해당 없음(상태 머신 변경 아님).
5. **권한·RBAC 충돌 없음** — 권한 체크 로직·엔드포인트 접근 제어 변경 없음(`Admin+`/`editor+` 등 기존 가드 유지, diff 에 가드 코드 변경 없음).
6. **계층 책임 충돌 없음** — 변경은 backend DTO·validation·테스트 레이어에 한정되며, 프런트엔드·다른 도메인 모듈의 책임 경계를 건드리지 않는다. `spec/2-navigation/6-config.md` 는 IP Whitelist 를 "허용 IP 목록 (선택)"으로만 서술해 null 여부를 규정하지 않으므로 하위 계약과 상충하지 않는다. `spec/3-workflow-editor/1-node-common.md`(같은 `modules/nodes/**` 코드를 문다)에는 `description` 필드 서술 자체가 없어 충돌할 문구가 없다.

부수 확인: CHANGELOG 항목("OpenAPI: 설명 · IP 화이트리스트를 null 로 지울 수 있다고 광고한다")의 서술("동작 변화는 없다")은 plan 의 실측 프로브(원 코드에서도 세 필드가 이미 200/null 동작)와 일치하며, 과장된 전칭 주장이 아니다.

## 요약

이번 변경은 스펙을 바꾸지 않는 순수 codebase 정정으로, 이미 문서화된 데이터 모델(nullable 컬럼)과 API 규약(§5.4 요청 바디 tri-state 예외)에 정확히 부합하는 "선언을 실제 동작에 맞추는" 성격의 패치다. 관련 있는 다른 spec 영역(§2-navigation 워크플로우 목록/설정 화면, §3-workflow-editor 노드 공통)과도 필드 정의·서술 수준에서 모순이 없다. Cross-Spec 관점에서 차단 사유나 후속 조치가 필요한 충돌은 발견되지 않았다.

## 위험도

NONE
