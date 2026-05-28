# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] execute() 내부 로컬 변수 추가 — 공유 상태 변경 없음
- 위치: `cafe24-mcp-tool-provider.ts` L1595–L1604 (`const { resource, operation } = opEntry; const apiInfo = {...}`)
- 상세: `apiInfo`는 `execute()` 호출 스코프 내에 한정된 로컬 변수다. `opEntry`에서 `resource`를 추가로 destructure하는 것은 `opMap`(읽기 전용 참조)에서 이미 저장된 값을 꺼내는 것이므로 공유 상태를 변경하지 않는다. `Cafe24McpToolProvider` 인스턴스의 어떤 필드(`ownedSidCounts`, `executionState`)도 수정되지 않는다.
- 제안: 이상 없음.

### [INFO] logUsage 호출 페이로드 확장 — 기존 호출자 영향 없음
- 위치: `cafe24-mcp-tool-provider.ts` L1705 (success 경로), L1730 (fail 경로)
- 상세: `logUsage` 시그니처가 `api` 필드를 이미 선택적(optional)으로 받는지 여부가 중요하다. 변경 전 코드는 `api` 없이 호출했으므로 추가 필드를 받는 타입이어야 정상 컴파일된다. 해당 시그니처가 plan(`cafe24-mcp-usage-api.md`)에서 PR #338에서 이미 도입된 것으로 명시돼 있으므로, `IntegrationsService.logUsage`가 `api` 필드를 수용하도록 이미 확장된 상태다. 본 변경은 해당 필드를 채우지 않던 경로를 채우도록 수정하는 것으로, 시그니처 자체에 변화가 없다.
- 제안: 이상 없음.

### [INFO] 테스트 파일 — 검증 범위 확장, 부작용 없음
- 위치: `cafe24-mcp-tool-provider.spec.ts` L746–L757 (success logUsage 검증), L837–L849 (auth-fail logUsage 검증)
- 상세: 테스트가 모킹된 `integrationsService.logUsage`에 `api` 필드 포함 여부를 추가로 assert한다. 이는 테스트-only 스코프이며, `jest.fn().mockResolvedValue(undefined)` 기반 mock이므로 실제 외부 서비스 호출이 없다. `Cafe24TransportFailedError` 케이스(L893–L898)는 기존 그대로 `api` 없이 검증하는데, 이는 transport 실패 경로도 `api: apiInfo`를 전달하는 구현과 대조하면 **테스트 커버리지 갭**이 있으나 부작용은 아니다 (별도 항목으로 기재).
- 제안: `Cafe24TransportFailedError` 케이스에도 `api` assertion을 추가해 transport 실패 경로의 apiInfo 전달을 회귀 보호할 것을 권장한다.

### [INFO] `Cafe24TransportFailedError` 케이스 — `api` assertion 누락 (테스트 커버리지 갭)
- 위치: `cafe24-mcp-tool-provider.spec.ts` L872–L899 (`translates Cafe24TransportFailedError into CAFE24_TRANSPORT_FAILED`)
- 상세: success / auth-fail 두 케이스에는 `api` assertion이 추가됐으나, `Cafe24TransportFailedError` 케이스는 `api` 없이 `expect.objectContaining({ status: 'failed', error: ... })`만 검증한다. 구현 코드(L1721–L1732)는 fail 경로 단일 블록으로 처리하므로 실제로는 `api: apiInfo`가 전달되지만, 테스트가 이를 명시하지 않아 미래 회귀를 잡지 못할 수 있다.
- 제안: 해당 it() 블록의 `integrationsService.logUsage` 검증에 `api: { label: 'cafe24.product.product_list', method: 'GET', path: expect.any(String) }` assertion 추가.

### [INFO] plan 문서 신규 생성 — 파일시스템 부작용 (의도된 변경)
- 위치: `plan/in-progress/cafe24-mcp-usage-api.md` (신규 파일)
- 상세: plan 디렉토리에 신규 파일을 추가하는 것은 CLAUDE.md 정책상 `in-progress/` 위치가 정확하고 `worktree` frontmatter가 명시돼 있어 규약을 준수한다. 의도된 파일시스템 변경이다.
- 제안: 이상 없음.

### [INFO] 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 — 변화 없음
- 상세: 이번 변경에서 전역 변수 도입·수정이 없다. 환경 변수 읽기/쓰기가 없다(`__resetForTesting`의 `NODE_ENV` 읽기는 기존 코드). 외부 HTTP 네트워크 호출이 새로 추가되지 않았다. 이벤트 발생·콜백 등록·해제 변화가 없다.

---

## 요약

이번 변경은 `Cafe24McpToolProvider.execute()` 내에서 `apiInfo` 로컬 변수를 구성하고 기존 두 `logUsage` 호출 지점에 `api` 필드를 추가하는 좁은 버그 픽스다. 공유 인스턴스 상태(`ownedSidCounts`, `executionState`), 전역 변수, 환경 변수, 외부 네트워크 호출, 이벤트/콜백 어느 것도 변경되지 않았다. `logUsage` 시그니처는 이미 PR #338에서 확장된 것을 채워 넣는 것이므로 호출자 파괴 변경이 없다. 유일한 주의 사항은 `Cafe24TransportFailedError` 케이스의 테스트에 `api` assertion이 빠져 transport 실패 경로의 apiInfo 전달이 회귀 보호되지 않는 커버리지 갭이나, 이는 기능 오동작이 아닌 테스트 완성도 문제다.

---

## 위험도

LOW
