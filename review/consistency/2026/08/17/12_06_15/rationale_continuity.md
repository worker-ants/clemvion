# Rationale 연속성 검토 결과

## 검토 범위

- 코드 diff(`origin/main...HEAD -- code_areas`): `sanitize-error-message.ts`(상수 재정렬 + 미러 주석 추가), `dynamic-form-ui.tsx`(마스킹 마커 감지 → 프리필 스킵 + 안내), 관련 테스트·i18n·문서
- 대조 대상 Rationale: `spec/5-system/14-external-interaction-api.md` §R17("잔여 ②", "프리필 왕복" 불릿), `spec/5-system/12-webhook.md` §5.3 Rationale, `spec/5-system/15-chat-channel.md` §R-CC-15, `spec/4-nodes/1-logic/12-background.md`, `spec/4-nodes/6-presentation/4-form.md` Rationale 등 번들 전체
- 보조 확인: `git diff origin/main...HEAD -- spec/` (해당 diff-base 대비 spec 도 함께 변경됨을 확인), `plan/in-progress/eia-masked-prefill-roundtrip-guard.md`

## 발견사항

없음. 아래는 판단 근거를 남기는 확인 기록(등급 없음).

- **"닫는 조건" 선언과 코드가 정확히 일치** — EIA §R17 "잔여 ②"는 종전 `트래커에 등재됐다`였던 문장을 이번 라운드에서 `"그 가드의 첫 조각이 2026-08-17 에 섰다 — 폼 프리필(DynamicFormUI)이 마커를 감지해 프리필을 건너뛰고 재입력을 안내한다"`로 갱신했고(`spec/5-system/14-external-interaction-api.md` diff, origin/main 대비), 코드 diff의 `isMaskedValue`/`initialValueFor`/hint 렌더링이 그 문장을 문자 그대로 구현한다. **결정 번복(카브아웃 → 마커 가드로의 확장)이 새 Rationale 불릿("프리필 왕복 — 2026-08-17")과 함께 커밋**돼 §3 "무근거 번복" 기준을 충족하지 않는다.
- **기각된 대안 재도입 없음** — webhook §5.3 Rationale이 기각한 "display 시점 마스킹"이나 EIA §R17이 언급한 "carve-out 전면 확대"를 재도입하지 않는다. 오히려 신설 불릿이 "판단 기준: 마스킹 대상이 외부로도 나가는가"를 명문화해, `formConfig`(SSE·notification webhook으로 외부 노출)는 마커 가드, `Execution.inputData`(외부 미노출)는 carve-out이라는 기존 축을 그대로 따른다.
- **마커 unmask 금지 원칙 준수** — `sanitize-error-message.ts`의 `MASKED_MARKERS`("절대 unmask 하지 않고, 이미 마스킹된 값을 다시 덮지 않을 뿐")를 프런트가 위반하지 않는다. 프런트는 마커를 원문으로 복원하지 않고 단지 프리필을 건너뛸 뿐이며, 이는 원칙과 같은 방향("한쪽으로만 열린다")이다.
- **SoT-미러 관용구 일관** — 신설 주석("프런트 미러가 있다… 이 집합을 바꾸면 그쪽도 함께 갱신")은 같은 파일의 기존 `DEFAULT_FILE_*` 미러 관용구와 동일 패턴이며, `plan/in-progress/eia-masked-prefill-roundtrip-guard.md`도 이 관용구를 명시적으로 따른다고 기록했다.
- **관련 typo 정정도 근거 동반** — `15-chat-channel.md` §R-CC-15의 `nodeName`→`nodeLabel` 정정은 "엔진 emit 전수가 `nodeLabel`이고 `nodeName` 사용처는 코드베이스에 0건"이라는 실측 근거 문구(2026-08-17 정정)를 동반해 반영됐다 — 근거 없는 번복이 아니다.
- **잔여 범위 과장 없음** — Re-run 모달·에디터 히스토리 로드 쪽 마커 가드는 이번 diff에 포함되지 않았고, spec 문구도 "확장하면 이 컬럼도 닫을 수 있다"로 미완료를 명시하며 `plan/in-progress/eia-masked-prefill-roundtrip-guard.md`에 추적 항목으로 등재돼 있다. Rationale이 실제보다 넓게 "완료"를 주장하는 정황 없음.

## 요약

이번 라운드의 코드 diff(백엔드 마스킹 상수 재정렬+미러 주석, 프런트 `DynamicFormUI` 마스킹 마커 감지 가드)는 `spec/5-system/14-external-interaction-api.md` §R17에 이미 기록된 "닫는 조건"을 문자 그대로 구현한 것이며, 그 spec 변경 자체도 같은 브랜치에서 코드와 함께 커밋되어 결정과 근거가 짝을 이룬다. 과거 Rationale이 기각한 대안(display-time 마스킹, `formConfig` carve-out)의 재도입이나, 합의된 unmask-금지·SoT-미러 원칙의 위반은 발견되지 않았다. 부수적인 `nodeLabel` 정정도 실측 근거를 동반한다. Rationale 연속성 관점에서 이 변경은 모범적으로 정합적이다.

## 위험도

NONE
