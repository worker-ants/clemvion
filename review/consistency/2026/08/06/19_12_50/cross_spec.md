# Cross-Spec 일관성 검토 — spec/7-channel-web-chat (impl-done)

## 발견사항

- **[INFO]** 검토 대상 diff 가 target spec 영역과 무관 (스코프 불일치)
  - target 위치: `spec/7-channel-web-chat/**` (1-widget-app.md·2-sdk.md·3-auth-session.md·4-security.md·_product-overview.md·0-architecture.md·5-admin-console.md 전체)
  - 충돌 대상: 실제 `git diff origin/main...HEAD`
  - 상세: 이번 impl-done 리뷰의 실제 코드 변경분(`git diff origin/main...HEAD --stat` 로 재확인)은 `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json` 의 `prepare` 스크립트(타입스크립트 부재 시 fallback 로직) 변경 6건과 `.claude/tests/test_packages_prepare_contract.py`·`.github/workflows/harness-checks.yml` 뿐이다. 이는 monorepo 패키지 빌드 툴링(스터일 `dist/` 재빌드 방지) 수정으로, `spec/7-channel-web-chat` 이 다루는 위젯 SPA·SDK·auth-session·admin-console·보안 어떤 표면도 건드리지 않는다. `web-chat-sdk` 패키지가 diff 에 포함된 것도 다른 5개 내부 패키지와 동일한 `prepare` 스크립트 패턴 통일일 뿐, 위젯/SDK 계약(BootConfig·postMessage 프로토콜·EIA 배선)에는 손대지 않았다. spec 본문도 이번 diff 로 신규/변경되지 않았다(브랜치 로그 확인 — `fix(packages): prepare 가 디렉터리 존재만 보고 있었다` 등 harness/CI 백스톱 작업).
  - 제안: cross-spec 관점에서 이번 diff 가 새로 도입하는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임은 없음. 아래 항목은 diff 와 무관하게 기존 spec 텍스트에 대한 정합성 spot-check 결과(참고용)이며, 이번 PR 의 BLOCK 사유가 될 수 없다.

## Spot-check (참고, diff 와 무관 — 기존 spec 텍스트 정합성)

diff 가 target 영역을 건드리지 않으므로 신규 충돌 판정 대상은 없으나, 번들에 포함된 `spec/7-channel-web-chat/**` ↔ `spec/0-overview.md`·`spec/1-data-model.md` 교차 참조를 실측 확인했다(EIA·conventions 등 예산 초과로 생략된 104개 파일은 실제 repo 경로에서 직접 열어 대조).

- Trigger 엔티티(`spec/1-data-model.md §2.8`): `workflow_id | UUID |`(옵션 표기 `?` 없음 = NOT NULL)이 `5-admin-console.md §3` 의 "필수 — `Trigger.workflow_id` NOT NULL" 주장과 일치.
- RBAC 역할 집합(`spec/1-data-model.md §2.3 WorkspaceMember.role = owner/admin/editor/viewer`)이 `5-admin-console.md §7` 의 `viewer+`/`editor+` 명명과 일치.
- EIA 엔드포인트(`spec/5-system/14-external-interaction-api.md §5.1~5.5`)의 `POST /api/external/executions/:id/interact`·`GET .../stream`·`GET /api/external/executions/:id`·`POST .../cancel`·`POST .../refresh-token` 경로·메서드가 `1-widget-app.md`·`5-admin-console.md §6` 이 인용하는 동일 경로와 일치.
- CORS 이중 표면(`4-security.md §2`)이 인용하는 "EIA §8.5 무제한 CORS(`/api/hooks/*`) 유지, `/api/external/*` 는 `interactionAllowedOrigins`+빌트인 위젯 CDN origin" 이 실제 `spec/5-system/14-external-interaction-api.md §8.5` 본문과 정합.

위 4개 항목 모두 CRITICAL/WARNING 급 모순 없음.

## 요약

이번 impl-done 리뷰에 부여된 target(`spec/7-channel-web-chat`)과 실제 diff(`origin/main...HEAD`)가 서로 무관하다 — diff 는 6개 내부 패키지의 `package.json` `prepare` 스크립트(및 대응 CI 테스트·워크플로 설정) 수정으로, 위젯 SPA·SDK·인증/세션·보안·운영 콘솔 어느 표면의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임도 신규 도입하거나 변경하지 않는다. 따라서 Cross-Spec 관점에서 이번 diff 가 다른 spec 영역과 충돌할 표면 자체가 없다. 참고로 수행한 target spec 텍스트(기존 내용) ↔ 0-overview/1-data-model/EIA/CORS 교차 참조 spot-check 에서도 모순은 발견되지 않았다.

## 위험도
NONE
