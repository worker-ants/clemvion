STATUS=success naming_collision review complete — no collisions found

===REPORT_MARKDOWN_BELOW===

# 신규 식별자 충돌 검토 — `eia-inputdata-marker-guard` (impl-done, scope=`spec/5-system/`)

## 방법

- 프롬프트 번들의 `<git diff origin/main...HEAD -- code_areas>` 섹션은 예산 초과로 절단돼 있어,
  이 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputdata-marker-guard`)에서
  `git diff origin/main...HEAD` 를 직접 산출해 실제 변경분을 확인했다.
- 이 PR 은 **오늘 같은 브랜치에서 이미 7회** consistency `naming_collision` 검토를 거쳤다
  (`12_08_46`, `12_29_59`, `12_41_29`, `12_58_14`, `14_44_42`, `15_10_56`, `15_33_05` — 전부
  충돌 없음으로 수렴). 본 세션(`15_59_50`)은 그 직후 라운드4 fix 커밋
  (`38b4669bd`, 15:59:08)까지 반영된 HEAD 를 대상으로 하므로, **`15_33_05` 이후 델타만
  추가 검증**하고 나머지는 재확인했다.

## 변경 요약 (신규 식별자 후보 전수)

`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳(폼 프리필·Re-run
모달·에디터 히스토리 로드)의 마커 가드. 신규 식별자는 다음이 전부다:

- **파일**: `codebase/frontend/src/lib/utils/masked-markers.ts` (신규), `.../__tests__/masked-markers.test.ts` (신규)
- **export**: `MASKED_MARKERS`, `isMaskedMarker`, `hasMaskedMarkerLeaf`
- **로컬 함수/상태** (`rerun-modal.tsx`): `splitMaskedParameters`, `touchedMaskedKeys`,
  `blockedByMaskedInput`, `isStructuredField` (라운드4 신설)
- **i18n 키**: `editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`
- **spec 서술 정정** (신규 ID 아님): `spec/3-workflow-editor/3-execution.md` §8 inputData
  데이터 흐름 문단 재작성 — 새 식별자 도입 없음, 기존 사실 서술 정정뿐

신규 requirement ID·엔티티/DTO·API endpoint·webhook/queue/SSE 이벤트명·ENV var·config key 는
**도입되지 않았다**.

## 점검 결과

1. **요구사항 ID 충돌** — 해당 없음. 이 PR 은 기존 `EIA §R17`/`RR-PL-`류 ID 를 인용만 하고
   새 ID 를 부여하지 않는다.
2. **엔티티/타입명 충돌** — 해당 없음. 새 타입 선언 없음(`Record<string, unknown>` 등 기존
   유틸 타입만 사용).
3. **API endpoint 충돌** — 해당 없음. 신규 endpoint 없음(기존 `POST /api/executions/:id/re-run`
   재사용).
4. **이벤트/메시지명 충돌** — 해당 없음. 신규 webhook/queue/SSE 이벤트명 없음.
5. **환경변수·설정키 충돌** — 해당 없음.
6. **파일 경로 충돌** — `masked-markers.ts` 는 `git diff --diff-filter=A` 로 신규 파일임을
   확인했고, 동일 경로에 기존 파일이 없었다. `lib/utils/` 디렉터리의 기존 명명 컨벤션
   (`date.ts`, `masked-markers.ts` 등 kebab-case 단수/합성어)과도 어긋나지 않는다.

### 함수/상수명 재사용 — 충돌 아니라 의도된 미러

- `MASKED_MARKERS`/`isMaskedMarker` 는 backend `sanitize-error-message.ts` 의 동명 상수/함수를
  **의도적으로 이름까지 동일하게** 복제한 프런트 미러다(주석에 명시: "미러의 동기화는 결국
  사람이 grep 으로 찾는다 — 이름이 갈리면 그 검색이 실패한다"). backend
  `VALUE_MASK_MARKER='***'` / `KEY_MASK_MARKER='[REDACTED]'` / `DEPTH_MASK_MARKER='[REDACTED_DEPTH]'`
  값과 프런트 `MASKED_MARKERS` 의 리터럴 `"***"`/`"[REDACTED]"`/`"[REDACTED_DEPTH]"` 를 대조
  확인 — 값·이름 모두 일치. 두 파일은 서로 다른 빌드 경계(NestJS backend vs Next.js CSR
  frontend)에 있어 이름이 같아도 동일 모듈로 import 되지 않으므로 실제 충돌(동일 스코프 내
  이중 정의)이 아니다.
- `isMaskedMarker`/`hasMaskedMarkerLeaf` 는 원래 `dynamic-form-ui.tsx` 안에 로컬 정의돼 있던
  것을 `lib/utils/masked-markers.ts` 로 승격(move)한 리팩터다 — `dynamic-form-ui.tsx` 는 이제
  새 위치에서 import 만 한다. 이름 재사용이 아니라 **동일 정의의 이동**.

### i18n 키 — 기존 "masked" 계열과 이름 겹침 없음

`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked` 두 키를 도입한다. 전체 dict 를
`masked`/`Masked`/`MASKED` 로 전수 grep 한 결과, 기존에 이미 존재하는 관련 키들과 이름이
정확히 겹치지 않음을 확인했다:

| 기존 키 | 네임스페이스 | 의미 |
|---|---|---|
| `authentication.keyMasked` | 계정 API 키 표시(`••••••••`) | egress 마스킹과 무관 |
| `editor.formMaskedDefaultHint` | 폼 프리필 마커 안내(#1181, 같은 계열 선행 작업) | 이름·의미 인접하지만 키 문자열 자체는 다름 |
| `integrations.rotateHint` | 연동 키 로테이션 UI | 무관 |
| `nodeConfigs.recordValuesHint` | 변수 수정 노드의 자체 시크릿 마스킹 | 무관 |
| `triggers.botTokenRegistered` | 봇 토큰 등록 표시(`•••• masked`) | 무관 |

`editor.formMaskedDefaultHint`(기존, #1181) 와 신규 `editor.runWithInputMasked` 는 같은
`editor` 네임스페이스에 "masked" 를 공유하지만 **키 이름이 서로 다르고 용도도 다르다**
(전자=폼 필드 프리필 안내, 후자=JSON 에디터 전체 Run 차단 안내) — 충돌이 아니라 같은 기능
계열의 자연스러운 이웃 관계다.

### 라운드4 신설 `isStructuredField`

`rerun-modal.tsx` 로컬 스코프에만 존재(전수 grep 확인, 다른 파일에 동명 식별자 없음).
export 되지 않으므로 충돌 표면이 없다.

## 요약

이번 PR 이 도입하는 신규 식별자는 파일 1개(`masked-markers.ts`)·export 3개
(`MASKED_MARKERS`/`isMaskedMarker`/`hasMaskedMarkerLeaf`, 기존 로컬 정의의 위치 이동)·
로컬 헬퍼 소수(`splitMaskedParameters`/`isStructuredField`)·i18n 키 2개
(`editor.runWithInputMasked`/`history.rerun.maskedInputBlocked`)로 범위가 좁고, 신규
requirement ID·엔티티·API endpoint·이벤트명·ENV var 는 전혀 도입하지 않는다. `MASKED_MARKERS`/
`isMaskedMarker` 의 backend-frontend 동명은 다른 빌드 경계 간 **의도된 미러**이고, i18n 키는
기존 dict 전체와 grep 대조해도 동명 키가 없다. 오늘 같은 변경분에 대해 이미 7회 수행된
naming_collision 검토와 결론이 일치하며, 라운드4 이후 신규 델타(`isStructuredField`, spec §8
서술 정정)에도 새 충돌 표면이 없다.

## 위험도

NONE
