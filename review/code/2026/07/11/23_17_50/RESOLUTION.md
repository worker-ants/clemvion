# RESOLUTION — 위젯 table 잘림 배너 총 개수 노출

리뷰 SUMMARY: risk **LOW**, Critical **0**, Warning **3** (+ INFO 11). `user_guide_sync` 는 disk-write
gap 이었으나 journal 복구 결과 **발견 없음**(doc-sync-matrix 어떤 trigger 도 미매칭 — channel-web-chat
은 hardcoded-korean 가드 스캔 밖). 전 관점 clean 확인. Warning 3건 조치 + 저비용 INFO 4건 조치.

## 조치 항목

| # | 카테고리 | 발견 | 조치 | fix |
|---|---|---|---|---|
| W1 | Documentation | `CHANGELOG.md` Unreleased 항목 누락(관례) | 최상단에 `## Unreleased — 웹채팅 위젯 table 잘림 배너 총 개수 노출` 추가 — 신규 필드·문구 변경·wire 무변경·**고객사 임베드 영향 가능** 명시(W3 동시 해소) | (본 커밋) |
| W2 | Documentation | `webchat-widget-presentation-followups.md` 항목 1 stale(구현 후 미갱신) | 항목 1 을 "table 부분 해소(본 branch)·carousel 잔여(항목 2 병합/의존)"로 재기술. 규약상 실완료 전 체크 금지라 미체크 유지(carousel 잔여) | (본 커밋) |
| W3 | Side Effect | 배너 문구 전면 교체(합쇼체→해요체+신규 분기) — iframe 임베드 고객사가 정확 문자열 의존 시 조용히 깨질 수 있음(내부는 spec/plan/test 동반 갱신 = 회귀 아님) | 코드 조치 불요(의도된 변경, 문서·테스트 완료). CHANGELOG 에 "고객사 임베드 영향 가능" 명시(W1) | (문서) |
| INFO 1 | Security/Testing/Requirement (3인 공통) | `totalCount` 가 `typeof number` 만 검사 — NaN/Infinity/음수 통과 → "총 NaN개…" 노출 위험(표시 위생) | `toTable` 가드를 `typeof number && Number.isFinite && >= 0` 로 강화(부적격은 undefined→폴백) + it.each 회귀 테스트(문자열/NaN/Infinity/음수) | (본 커밋) |
| INFO 5 | Testing | truncated=false + rowsTotalCount 조합(값 투영·배너 미노출) 미검증 | `toTable — truncated=false 여도 유효 rowsTotalCount 는 투영` 테스트 추가 | (본 커밋) |
| INFO 6 | Testing | 부재/이형 케이스가 한 `it` 에 병합 | it.each 로 분리(부재 별도 + 이형·NaN·Infinity·음수 파라미터화) | (본 커밋) |
| INFO 9 | Requirement | spec-draft plan "후속 구현" 절 인용 문구(`~됩니다`)가 문체 결정(해요체)과 자기불일치 | 폴백 인용을 `일부 행만 표시돼요.` 로 정정(문서) | (본 커밋) |

### 조치 불요 INFO (사유)
- INFO 2(itemsTotalCount carousel dead field)·INFO 7(carousel negative test): carousel 배너는 본 PR 스코프 밖(별건 followup) — 착수 시 처리. YAGNI.
- INFO 3(다국어 시 formatter 추출)·INFO 4(totalCount-truncated 불변식 미강제)·INFO 8(JSDoc 중복)·INFO 10(문체 번들)·INFO 11(배너 분기 인라인 주석): 현 스코프 과잉설계/근거 문서화됨 — 조치 불요.

## TEST 결과

fix 후 TEST WORKFLOW 전체 재수행:
- **lint**: 통과 (`stage=lint status=PASS`)
- **unit**: 통과 (`stage=unit status=PASS`; 위젯 타겟 78 tests, full suite PASS)
- **build**: 통과 (`stage=build status=PASS`)
- **e2e**: 통과 (`stage=e2e status=PASS duration=221s tests=253 passed`) — channel-web-chat 은 backend e2e 범위 밖이나 화이트리스트 밖 코드 변경(presentation.ts)이라 cross-stack 회귀 넷으로 수행, 회귀 없음

## 보류·후속 항목
- **carousel 잘림 배너(+총 개수)**: 배너 자체가 0→1 신설이라 본 PR 스코프 밖 — `webchat-widget-presentation-followups.md` 항목 2(항목 1 carousel 잔여와 병합)가 추적.
