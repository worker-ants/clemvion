# RESOLUTION — fix-carousel-waiting-status-4d4ed3 / 2026-06-06/14_45_26 (2차 리뷰)

2차 `/ai-review` (resolution-applier 코드 fix `ecc17b15` 포함 최종 상태 검증). RISK=LOW, Critical 0.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| W1 | spec (SPEC-DRIFT) | 후속 plan 분리 | 사용자 결정(2026-06-06) — `plan/in-progress/spec-update-execution-engine-pre-park-window.md` 로 project-planner 위임. 본 PR 코드 유지 |
| W2 | spec (SPEC-DRIFT) | 후속 plan 분리 | W1 과 동일 draft 통합 |
| W3 | 코드(문서) | 42f937ea | `reconcilePreParkWaitingStatus` JSDoc 에 frontend `isNodeWaitingForInput` 역방향 동기화 ref 추가 (의도적 중복 방어 레이어 양방향 연결고리 완성) |

## INFO 항목 조치 현황

| INFO # | 카테고리 | 조치 |
|--------|----------|------|
| I9 | 테스팅 | 이미 해소 — 첫 intra-row(prevStatus=waiting wipe 차단) 테스트에 per-node `nodeStatuses` 단언 존재(test L371-374, ecc17b15 에서 추가됨). 추가 조치 불요 |
| I1 | 아키텍처 | W3(역방향 ref)로 양방향 연결고리 완성. 컴파일타임 강제·e2e 드리프트 탐지는 장기 후보 기록 |
| I2 | 아키텍처 | shallow copy — 현재 status 만 교체라 적절. 향후 outputData 정규화 시 deep copy 필요(후보 기록) |
| I5 | 아키텍처 | blocking outputData envelope 계약 spec 명시 → spec-update draft 에 포함 권고(후속) |
| I7 | 요구사항 | PENDING 포함 의도적 — backend/frontend 양측 테스트 존재(ecc17b15) |
| I8 | 테스팅 | `ai_agent` nodeType 픽스처: 함수가 nodeType 무관(outputData.status 필드 위치 동일)이며 form/ai 케이스는 추가됨. 추가 픽스처는 선택 |
| I11 | 문서화 | spec §1.1 갱신 전 링크 공백 — 후속 plan 으로 추적(draft 명시) |
| I12 | 보안 | e2e fallback JWT — 기존 값 포맷 변경만, env 우선 패턴 보호. 운영 유입 없음 |
| I13 | 동시성 | pre-park window 근본 제거(두 save 단일 트랜잭션)는 후속 작업 후보 기록 |
| I15 | 유지보수 | plan/complete 이동: follow-up(spec-update) 미완으로 in-progress 유지 — 의도(SKILL §10 "follow-up 0건" 미충족) |
| I3·I4·I6·I10·I14 | 기타 | INFO only — 추적 기록, 코드 변경 없음 |

## TEST 결과

- lint  : 통과 (45s)
- unit  : 통과 (40 stages — backend+frontend+web-chat-sdk+channel-web-chat)
- build : 통과 (77s, docker 이미지 검증 포함)
- e2e   : 통과 (175/175)

## 보류·후속 항목

- **SPEC-DRIFT (W1/W2)**: `plan/in-progress/spec-update-execution-engine-pre-park-window.md` — 사용자 결정으로 후속 분리. project-planner 가 exec-park Phase-B 정리 후 `/consistency-check --spec` → spec §1.1 반영. 삽입 순서 NOTE 포함.
- INFO I3(export 캡슐화)·I13(window 근본 제거)·I2(deep copy) — 별도 리팩토링 후보 기록.
</content>
