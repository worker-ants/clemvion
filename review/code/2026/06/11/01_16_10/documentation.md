# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] 테스트 헬퍼 JSDoc — 기존 패턴의 약점 설명이 다소 장황
- 위치: `integration-expiry-scanner.service.spec.ts` L35-52 (`getNotifResourceIds` JSDoc)
- 상세: 헬퍼 설명이 "기존 이중 `.flat()` 패턴의 약점"까지 서술하고 있어 JSDoc 본래 목적(사용법·반환값 설명)을 넘어섰다. 기존 패턴의 약점 설명은 git 이력이나 커밋 메시지에 적합한 내용이며, 헬퍼 자체의 계약(입력·반환값)만 기술하면 충분하다.
- 제안: 약점 설명 부분은 헬퍼 선언부 JSDoc에서 제거하거나 한 줄 `@see` 참조로 단축. 반환값·주의사항 위주로 압축.

### [INFO] `hasSavedExpired` JSDoc — 대체 패턴 참조 설명 중복
- 위치: `integration-expiry-scanner.service.spec.ts` L54-57 (`hasSavedExpired` JSDoc)
- 상세: "기존 `mock.calls.flat().arr.some(...)` 중첩 패턴 대체" 설명이 함수의 역할(무엇을 검사하는가)보다 대체 이력에 치중한다. 헬퍼가 충분히 자명한 이름을 가지고 있어 이력 서술은 불필요한 잡음이다.
- 제안: "0d 분기에서 `status='expired'` 로 저장이 시도됐는지 반환한다" 수준의 한 줄 요약으로 대체.

### [INFO] `isRefreshCapable` JSDoc — 함수명 변경 이력 기술 불필요
- 위치: `integration-expiry-scanner.service.ts` diff, `isRefreshCapable` JSDoc
- 상세: JSDoc 본문에 "향후 다른 first-party Integration (Shopify 등) 이 같은 패턴을 쓰면 여기에 추가" 라는 확장 지침이 포함되어 있다. 공개 함수의 API 문서보다 내부 개발 지침에 가까운 서술이다. 다만 이 파일은 모듈 내부 헬퍼 함수(`private` 수준)이므로 심각도는 낮다.
- 제안: 확장 지침은 `TODO:` 주석 또는 spec 문서에 위임하고 JSDoc 에서는 현재 동작·판별 기준만 기술.

### [INFO] `integration-status-reason.ts` `token_expired` 주석 — 라인이 80자를 훨씬 초과
- 위치: `integration-status-reason.ts` L1008 (`token_expired` 인라인 주석)
- 상세: 인라인 주석이 spec §11.2 참조, DB-only 네임스페이스 경고, JWT 에러 코드 구분까지 한 줄에 담아 가독성이 낮다. 동일 파일의 다른 항목(`auth_failed`, `install_timeout`)이 20~40자 수준인 것과 일관성이 맞지 않는다.
- 제안: 짧은 한 줄 설명(`// refresh_token 없는 provider 의 token_expires_at 만료 → status=expired`)만 남기고, 네임스페이스 충돌 경고는 파일 상단 JSDoc 의 `@remarks` 또는 별도 `/* */` 블록 주석으로 분리.

### [INFO] `system-status.constants.ts` MONITORED_QUEUES JSDoc — 갱신 의무 대상에 spec 문서 링크 미기재
- 위치: `system-status.constants.ts` L1187-1188 (`MONITORED_QUEUES` JSDoc 추가분)
- 상세: "큐 추가/삭제 시 `data-flow/0-overview.md §4` 카탈로그를 먼저 갱신" 및 `test/system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES` 갱신 지침이 추가됐다. 좋은 가이드이나 spec 경로가 상대 경로 없이 파일명만 언급되어 있어, 프로젝트를 처음 접하는 개발자가 정확한 위치를 즉시 찾기 어렵다.
- 제안: `data-flow/0-overview.md §4` → `spec/data-flow/0-overview.md §4` 형태로 루트 상대 경로 명시. (큰 문제는 아니며 현행 코드 관행과 동일 수준)

### [INFO] `system-status.constants.spec.ts` 파일 — 모듈 레벨 주석 위치가 `describe` 안에 포함
- 위치: `system-status.constants.spec.ts` L1097-1102
- 상세: `describe` 블록 바로 안의 JSDoc이 파일 레벨 설명 역할도 겸하고 있다. 파일 레벨 JSDoc과 `describe` 블록 내 설명을 분리해 두면 테스트 파일 전체 목적이 더 명확해진다. 다만 테스트 파일 관행 내에서 일반적으로 허용되는 패턴이다.
- 제안: 현행 유지 가능; 만약 향후 `describe` 블록이 추가될 경우 파일 상단에 별도 주석 분리 권장.

### [INFO] `plan/complete/integration-expiry-fixes.md` — 체크리스트의 커밋 해시 링크 미제공
- 위치: `plan/complete/integration-expiry-fixes.md` L1578-1579
- 상세: 구현 커밋(`1286b3e5`)과 spec 정합 커밋(`78af3d00`)이 단순 해시 문자열로 기재돼 있어 추적성은 확보됐으나, 클릭 가능한 링크가 아니어서 이력 추적 시 수동 검색이 필요하다.
- 제안: GitHub URL 형태 링크로 변환하거나 현행 유지(단순 참조용 문서이므로 무방).

### [INFO] `spec/2-navigation/4-integration.md` `isRefreshCapable` 결정 Rationale 섹션 — 위치가 spec 본문 끝 가까이에 있어 검색성 낮음
- 위치: `spec/2-navigation/4-integration.md` L1927-1933 (diff)
- 상세: `### isRefreshCapable — makeshop 포함 결정` 섹션이 Rationale 섹션 안이 아니라 §11.2 알림 생성 섹션 바로 뒤에 삽입됐다. 기각 대안·근거 등 의사결정 내용이므로 `## Rationale` 하위에 위치하는 것이 spec 3섹션 구성 규약(Overview / 본문 / Rationale)에 더 부합한다.
- 제안: 해당 소항목을 문서 말미 `## Rationale` 영역으로 이동 검토. 단, 본 항은 §11.2 와 직결된 보충 설명 성격이 강해 현 위치도 수용 가능하다.

### [INFO] `spec/data-flow/5-integration.md` — 폐기 섹션 삭제 후 context 명시 개선
- 위치: `spec/data-flow/5-integration.md` diff L2064-2077
- 상세: 이전에 "알려진 구현 갭" 으로 기술됐던 callout 블록과 폐기 서술들이 제거되고 "V-01·V-07 fix 로 해소" 단일 서술로 대체됐다. 해소된 갭이 무엇인지 이력이 남아 있어 좋으나, 해소 기준 날짜(2026-06-10)와 PR 번호가 해당 섹션에는 기재되지 않았다. (`plan/complete/` 에는 있음)
- 제안: 폐기 서술 말미에 `(#PR번호, 2026-06-10)` 형태의 참조 추가 검토. 현재 plan/complete 문서로 연결하는 하이퍼링크가 없어 추적이 불편할 수 있다.

---

## 요약

이번 변경은 V-01(makeshop 오격하), V-07(§11.2 알림 정책 채택), V-15(큐 레지스트리 동기)의 세 결함을 수정하면서 코드·spec·테스트를 함께 갱신한 묶음이다. 문서화 측면에서 전반적으로 높은 품질을 보인다 — `isRefreshCapable` 함수 JSDoc, spec §11.1 표 의사코드, data-flow sequenceDiagram, status_reason 매핑 표, 데이터 모델 컬럼 설명이 구현과 일관되게 갱신됐으며, plan 문서에 결정 근거·커밋·체크리스트가 상세히 기록됐다. 다만 일부 테스트 헬퍼의 JSDoc이 구현 이력 서술에 치우쳐 있고, `token_expired` 인라인 주석이 비일관적으로 길며, `isRefreshCapable` 결정 Rationale 섹션의 배치가 spec 3섹션 구성 규약과 미묘하게 어긋난다는 소소한 INFO 수준 사항들이 존재한다. CRITICAL 또는 WARNING 수준의 문서화 결함은 발견되지 않았다.

## 위험도

LOW
