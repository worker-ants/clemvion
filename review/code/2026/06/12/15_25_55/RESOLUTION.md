# RESOLUTION — code-node-cleanup ai-review (15_25_55)

리뷰 결과: **RISK LOW · Critical 0 · Warning 3**. Critical 없음. Warning 3건은 선재 이슈
또는 의도된 breaking fix 로 즉시 블로킹 사유 아님 — 아래와 같이 조치/검증.

## 조치 항목

| # | 카테고리 | 발견 | 조치 | commit |
|---|---|---|---|---|
| W1 | 성능 | `isolated-vm` per-exec Isolate 생성 비용 | **선재·추적 중** — 본 PR 무관(`plan/complete/code-node-isolated-vm.md` §운영영향). 코드 변경 없음. no-op | — |
| W2 | 유지보수성 | `body?.newBotToken` vs `body.newBotToken` optional chaining 불일치 (선재 nit, 본 PR 미도입) | 내가 편집 중인 파일이라 동반 정리 — 두 번째 조건도 `body?.newBotToken` 으로 통일 | `<refactor-hash>` |
| W3 | API 계약 | `WORKSPACE_REQUIRED`(401) → `WORKSPACE_ID_REQUIRED`(400) breaking change | **의도된 fix** (consistency CRITICAL 해소). 클라이언트 영향 검증 — `codebase/frontend/src`·`codebase/channel-web-chat` 에 `WORKSPACE_REQUIRED` 하드코딩 분기 **전무**(grep 확인). 마이그레이션 불요. no-op | — |

### INFO 처리
- **INFO #6** (§5.4 `INVALID_BOT_TOKEN` `:52` 앵커): controller 의 `INVALID_BOT_TOKEN` throw 가 **여전히 line 52** (내 편집이 그 위치를 밀지 않음) → 앵커 정확, 수정 불요.
- **INFO #1·#2 (security/architecture)**: 본 변경이 JWT fallback 버그 해소 + SRP 강화로 **개선**이라 평가 — 조치 불필요.
- **INFO #3·#4·#5·#7 (forwardRef 순환·decorator 테스트 보강·ERROR_KO 매핑)**: 아래 §보류·후속.

## TEST 결과

- **lint**: 통과 (PASS)
- **unit**: 통과 (PASS, 40 tests — chat-channel.controller.spec 4 passed)
- **build**: 통과 (PASS)
- **e2e**: 통과 (PASS, 188 tests / 32 suites — W2 fix 는 optional-chaining 1자로 e2e 경로 동작 동일, 재확인 통과)

## 보류·후속 항목

- **INFO #7** — `backend-labels.ts` `ERROR_KO["WORKSPACE_ID_REQUIRED"]` 한국어 라벨 미등록. **선재** (`WORKSPACE_REQUIRED` 도 원래 미등록 → 본 변경이 새 gap 도입 안 함, 회귀 없음). `WORKSPACE_ID_REQUIRED` 는 statistics·audit-logs·nodes 등 다수 엔드포인트 공용 canonical 코드라, 한 곳이 아닌 i18n 일괄 pass 로 다루는 게 적절 — 별 후속.
- **INFO #4·#5** — `workspace.decorator.spec.ts` 빈 문자열 헤더 명시 케이스 + `code` 필드 단언 보강. 공용 데코레이터 spec 영역 — 별 후속.
- **INFO #3 (architecture)** — `TriggersModule ↔ ChatChannelModule` `forwardRef` 순환 의존. 본 PR 범위 밖 중장기 항목.
- **W1 (performance)** — isolated-vm Isolate pool/snapshot 재사용. `code-node-isolated-vm-followups`(이미 complete/) 의 성능 항목으로 추적됨.
