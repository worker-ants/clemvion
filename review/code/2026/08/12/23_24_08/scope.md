### 발견사항

- **[INFO]** outer 캐시 JSON 손상 경로에 신규 `warn` 로그가 추가됨 — 이 PR 의 표제 결함(`responseJson` 내부 손상 무방비)보다 한 칸 넓은 변경
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149` (`return this.discardCorruptEntry('엔트리', err, processFresh);`)
  - 상세: 원본(diff 제거분, 해당 라인은 게이트가 비어 있음 — `- }  catch { // 손상된 캐시 → 무시하고 신규 처리.` 블록)에서는 바깥 JSON(`cachedJson`) 파싱 실패 시 **조용히** `next.handle()` 로 강등했고 warn 을 남기지 않았다. 이번 변경은 `discardCorruptEntry()` 로 통합하면서 바깥 손상 경로에도 warn 을 새로 추가한다(`idempotency.interceptor.spec.ts:535-557` 신규 테스트 `'엔트리 손상은 조용히 넘어가지 않는다 — warn 을 남긴다'` 가 이를 검증). PR 의 plan 항목 제목(`plan/in-progress/backend-lint-gate-broken-on-main.md:610`)은 "캐시 엔트리 **내부** `responseJson` 손상은 무방비" 로, 문자 그대로는 안쪽 payload 파싱만을 가리킨다.
  - 이 확장은 은폐된 것이 아니라 같은 파일 619-622행에 "두 자리 모두 이제 warn 을 남긴다(종전에는 바깥 손상도 조용히 넘어갔다 — fail-open 은 '요청을 살린다 + 장애를 보이게 한다' 가 한 쌍)" 로 명시 근거와 함께 기록돼 있고, 클래스의 다른 3개 실패 경로(GET·SET·직렬화)가 이미 같은 패턴으로 warn 하는 것과 일관성을 맞추는 목적이라 결함 클래스가 사실상 동일하다. 코드 변경량도 1줄(warn 문 재사용)로 미미하다.
  - 제안: 별도 조치는 불필요 — 문서화·근거·테스트가 모두 갖춰져 있어 리뷰 관점에서는 "확장 사실을 인지하고 넘어가는" INFO 로 충분하다. 다만 향후 유사 PR에서는 plan 항목 제목이 "내부" 로 좁게 적혀 있어도 실제 변경 범위는 "손상 처리 전체" 로 넓어질 수 있음을 착수 시 plan 제목에 명시하면 이런 재확인 비용을 줄일 수 있다.

### 요약

3개 파일(구현 `idempotency.interceptor.ts`, 테스트 `idempotency.interceptor.spec.ts`, plan 상태 문서) 모두 "캐시 엔트리 내부 `responseJson` 손상이 500 으로 마스킹되는 결함" 이라는 단일 의도에 직접 묶여 있다. 구현 변경은 `switchMap` 콜백을 `processFresh`/`discardCorruptEntry` 로 재구성해 (1) `responseJson` 을 한 번만 파싱하고 그 자리에 방어를 두며 (2) `bodyHash` 판정을 payload 파싱보다 앞에 두는 순서를 고정하는데, 이는 plan 문서(618행)가 이미 "두 자리를 한 번만 파싱하도록 끌어올리고 그 자리에 방어를 두는 편이 낫다"로 사전에 계획해 둔 리팩터이지 무관한 정리가 아니다. 테스트 4건은 각각 신규 방어의 정상/재현(성공채널)/재현(에러채널)/판정 순서를 자매 자리까지 빠짐없이 검증하며 표제 결함을 정확히 겨냥한다. plan 파일 diff 는 체크박스 갱신 + 완료 노트뿐으로 실질 코드와 1:1 대응한다. 임포트·포맷팅·설정·무관 파일 변경은 없다. 유일하게 짚을 점은 위 INFO 하나로, 표제보다 살짝 넓게 바깥 JSON 손상 경로에도 warn 을 추가했지만 이는 문서화된 근거가 있고 같은 결함 클래스의 형제 자리를 닫는 성격이라 범위 이탈로 보기는 어렵다.

### 위험도

NONE
