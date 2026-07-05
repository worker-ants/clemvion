# RESOLUTION — ResultDetail waiting props 공용 hook 추출 (V-05 후속)

## 조치 항목

| SUMMARY # | 내용 | 조치 | commit |
|---|---|---|---|
| W-1 (convention WARNING) | §1.2 매트릭스 (d)→(f) 레터 갭 (page (e) 병합으로 소거) | (f)→(e)·(g)→(f) 재번호로 (a)~(f) 연속화 (§1.2 4행 + rule 3 + resume 노트) | (본 resolution commit) |
| INFO (cross-spec) | rule 3 drawer `isLiveConversation` "TS 로만 커버" 부정확 | plain `||` subset 소비처(두 가드 밖, 신규 enum non-live 자동) 로 정정 | 동일 |
| INFO (testing) | 부분 assertion·null-state 누락 | buttons·ai_conversation·ai_form_render full `toEqual` 배타성 + null 케이스 추가(5→6) | 동일 |

Critical 0. Warning 1건 해결. INFO 2건 반영.

## TEST 결과

- **lint**: 통과 (stage=lint status=PASS)
- **unit**: 통과 (stage=unit status=PASS, 48 passed — hook 6 + exhaustiveness 2 포함)
- **build**: 통과 (refactor 커밋 `b6a9c6cf5` 에서 PASS; resolution 은 spec doc + test-only 로 production 무변경)
- **e2e**: 통과 — 커밋 `b6a9c6cf5`(production 코드 동일) 에서 `stage=e2e status=PASS tests=236`. Resolution batch 는 production `.ts`/`.tsx` 라인 delta 0(spec `.md` + `.test.ts` 만)이라 런타임 동작 불변 → 동일 e2e 결과 유효.

## 보류·후속 항목

없음. V-05 후속 (refactor) hook 항목 완결. 남은 cross-audit 후속: (low) orphan i18n 키 제거 + 폴더 rename 검토 (refactor #3, 별 PR).
