# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] node_modules 심볼릭 링크 포함 (파일 14)
- 위치: `node_modules` (diff 파일 14)
- 상세: `node_modules -> /Volumes/project/private/clemvion/node_modules` 심볼릭 링크가 신규 파일로 diff 에 포함됐다. 워크트리 공유 node_modules 심링크 설정으로 실제 코드 변경이 아니며, `.gitignore` 에 의해 커밋에서 제외되어야 할 항목이다. 이 변경이 코드 범위에 포함된 이유는 리뷰 도구가 워킹트리 전체 diff 를 수집했기 때문으로 보인다.
- 제안: `.gitignore` 에 `node_modules` 가 포함돼 있는지 확인. 리뷰 diff 생성 시 node_modules 를 제외하도록 수집 로직을 보완.

### [INFO] review/ 산출물 파일 포함 (파일 15~18 외 다수)
- 위치: `review/consistency/2026/06/19/17_39_03/` 하위 파일들
- 상세: consistency check 산출물(`SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md` 등)이 코드 리뷰 대상에 포함됐다. 이 파일들은 구현 착수 전 `--impl-prep` 단계의 정상 산출물이며, CLAUDE.md 규약상 `review/` 디렉토리는 코드 리뷰 산출물 저장소로 지정돼 있어 커밋 대상이 맞다. scope 리뷰 관점에서는 이 파일들이 코드 변경과 독립적인 별도 관심사이므로 의도한 포함임을 확인.
- 제안: 문제 없음. 워크플로우 상 impl-prep consistency check 후 구현 후 ai-review 순서가 올바르게 수행됐음을 확인.

### [INFO] `execution-event-emitter.service.ts` 에 `forwardRef` 추가 (파일 6)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-di-isp-2288fe/codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
- 상세: `engine->Retry` 역방향 DI 제거로 인한 ES-module 순환 경로 변화에 대응해 `WebsocketService` 주입에 `forwardRef` 가 추가됐다. 이 변경은 ISP 적용에 따른 DI 그래프 재구성의 필연적 부산물로, 독립된 기능 변경이 아니다. 동작은 불변하며 순환 참조 해소 목적의 최소 변경이다.
- 제안: 범위 내 정당한 변경. `@Inject(forwardRef(() => WebsocketService))` 추가가 실제로 순환을 해소하는지 DI 그래프를 별도 검증할 것을 권장.

## 요약

본 변경은 "C-1 후속 ④ — EngineDriver ISP 분리 + engine->Retry 단방향 DI 정리"로 명확히 정의된 범위 내에서 일관되게 수행됐다. 핵심 변경은 (a) `EngineDriver` 단일 인터페이스를 `CoreEngineDriver` / `InteractionEngineDriver` / `ReentryStateDriver` / `AiTurnEngineDriver` / `RetryEngineDriver` / `EngineDriver`(합집합)로 ISP 분해, (b) 각 소비 서비스가 자신의 부분 인터페이스만 주입받도록 교체, (c) `engine->RetryTurnService` 역방향 DI 제거로 엔진 thin delegator 삭제 및 외부 진입점이 `RetryTurnService` 를 직접 호출하도록 재배선, (d) 이에 대응한 테스트 수정으로 구성된다. 의도 이상의 기능 추가나 무관한 파일 수정은 발견되지 않았다. `node_modules` 심링크와 `review/` 산출물 파일이 diff 에 포함된 점은 리뷰 수집 방식에 기인하며 코드 범위 일탈이 아니다. `execution-event-emitter.service.ts` 의 `forwardRef` 추가는 DI 재구성의 부산물로 범위 내 정당한 변경이다.

## 위험도

NONE
