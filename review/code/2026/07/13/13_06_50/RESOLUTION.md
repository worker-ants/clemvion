# Resolution — edge §1.3 ai-review 2회차 (2026-07-13 13:06)

CRITICAL 수정 커밋(`b15141f12`) 후 fresh 검토 결과 **MEDIUM (CRITICAL 0, WARNING 5 + SPEC-DRIFT 1)**. CRITICAL 해소 확인. disk-write gap(architecture/documentation/user_guide_sync)은 journal.jsonl 로 복구해 함께 반영.

## SPEC-DRIFT / 문서

| 발견 | 조치 |
|------|------|
| `onReconnectStart` 배선 서술이 spec/CHANGELOG/plan 3곳에 잔존(CRITICAL 수정 때 코드에서 제거했으나 문서 미갱신) + `workflow-canvas.tsx` 인라인 "세 콜백" 주석 stale | **반영** — 세 문서 + 인라인 주석을 "`onReconnect`/`onReconnectEnd` 두 콜백" 으로 정정. |
| plan 이 개명 전 `deleteEdge` 2곳 + 테스트 개수 "3" 오기(실제 4) | **반영** — `removeEdge` 로, 개수 4 로 정정. |
| spec/CHANGELOG 의 `evaluateConnectionRejection` (개명됨) | **반영** — `evaluateConnection` 으로 정정. |

## WARNING

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 2 | testing | onReconnect 포트색(`edgeData`) 재계산이 미검증(테스트 모두 `sourceHandle` 고정) | **반영** — `sourceHandle` 을 `out`→`error` 로 바꾸는 재연결 테스트 추가, `data.portType` 이 `error` 로 재계산됨을 단언. |
| 3 | testing | `detectContainerConflict` 거부 경로가 onConnect/onReconnect 어디서도 미검증 + 직전 RESOLUTION 의 "이미 검증됨" 스킵 근거가 사실과 다름 | **반영** — onReconnect body→이미 다른 컨테이너 child 로의 컨테이너 충돌 거부 테스트 추가(공용 `evaluateConnection` 경로 실증). `12_40_48/RESOLUTION.md` 의 오서술도 정정. |
| 4 | maintainability | `evaluateConnectionRejection` 의 `null`/`""`/문자열 sentinel 이 truthy 단축 실수에 취약 | **반영** — `{ ok: true } \| { ok: false; message? }` 판별 유니온(`evaluateConnection`)으로 리팩터, 호출부는 `if (!result.ok)`. |
| 5 | 리뷰 인프라 | architecture/documentation/user_guide_sync disk-write gap | **journal 복구** — architecture: onReconnectStart WARNING(위 반영) + DIP/중복해소 INFO 긍정. documentation: onReconnectStart·"세 콜백"·plan deleteEdge WARNING(위 반영). user_guide_sync: `containers-and-tools.mdx`(ko/en) "드래그가 아니라 재연결" 이 §1.3 끝점-드래그와 애매 INFO → "노드를 드래그해 넣는 게 아니라 body/emit 연결선 재연결" 로 명확화. |

## INFO(반영/이월)
- removeEdge 컨테이너 containerId 재도출 미검증(INFO) → **테스트 추가**(body 엣지 제거 시 자식 containerId=null 재도출).
- 구조적 엣지(body/emit) 재연결 표면(INFO, 서버 검증 이중방어로 즉각 위험 없음) → 이월.
- tsc 가 `*.test.ts` exclude 하는 구조적 사각지대(INFO) → 별도 트랙 이월(§1.3 범위 밖).
- 무변화 pushUndo(INFO) → 영향 미미, 이월.

## 검증
- tsc `--noEmit` clean · vitest **125 passed**(reconnect 훅 4 + store 63[onReconnect 6·removeEdge 2 포함] + edge-utils 59) · eslint 0 errors
- e2e `make e2e-test-full` + fresh `/ai-review` 후속(수렴 확인).
