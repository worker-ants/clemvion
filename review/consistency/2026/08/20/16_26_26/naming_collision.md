STATUS=success naming_collision review complete — no collisions found

===REPORT_MARKDOWN_BELOW===

# 신규 식별자 충돌 검토 — `eia-inputdata-marker-guard` (impl-done, scope=`spec/5-system/`)

## 방법

프롬프트 번들의 `<git diff origin/main...HEAD -- code_areas>` 섹션과 다수의 spec 파일 본문이
컨텍스트 예산 초과로 절단돼 있어, 이 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputdata-marker-guard`, HEAD=`e1607c737`)
에서 `git diff origin/main...HEAD` 를 직접 산출해 전체 변경분을 확인했다. 이 PR 은 같은
브랜치에서 오늘 이미 8회 `naming_collision` 검토를 거쳤고(`12_08_46` ~ `15_59_50`) 전부
충돌 없음으로 수렴했다. 본 세션은 그 마지막 라운드(`15_59_50`, HEAD=`38b4669bd`) 이후
붙은 라운드5 fix 커밋(`e1607c737`)까지 반영해 델타를 재확인하고, 전체 변경분도 독립적으로
재검증했다.

## 변경 요약 (신규 식별자 후보 전수)

`Execution.inputData` egress 마스킹 카브아웃 폐지(§R17) + 재제출 소비처 3곳(폼 프리필·
Re-run 모달·에디터 히스토리 로드)의 마커 가드. 신규 식별자는 다음이 전부다:

- **신규 파일**: `codebase/frontend/src/lib/utils/masked-markers.ts`,
  `.../lib/utils/__tests__/masked-markers.test.ts`
- **export**: `MASKED_MARKERS`, `isMaskedMarker`, `hasMaskedMarkerLeaf`
  (`dynamic-form-ui.tsx` 로컬 정의를 그대로 이동한 것 — 재정의가 아니라 위치 이동)
- **로컬 함수/상태** (`rerun-modal.tsx`): `splitMaskedParameters`, `touchedMaskedKeys`,
  `blockedByMaskedInput`, `isStructuredType`(라운드5, 구조 타입 술어 3중복 통합), `isStructuredField`
- **i18n 키**: `editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`
- **spec 서술 정정** (신규 ID 아님): `spec/5-system/{6-websocket-protocol,12-webhook,
  13-replay-rerun,14-external-interaction-api}.md`, `spec/1-data-model.md`,
  `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/1-logic/12-background.md` 의 기존
  카브아웃 서술을 "마스킹 대상" 으로 뒤집는 편집 — 새 requirement ID·엔티티·필드명 도입 없음

신규 requirement ID·엔티티/DTO·API endpoint·webhook/queue/SSE 이벤트명·ENV var·config key 는
**도입되지 않았다**.

## 점검 결과

1. **요구사항 ID 충돌** — 해당 없음. `EIA §R17`(잔여 ② 종결) · `RR-PL-02` 등 기존 ID 를
   인용·재해석만 하고 새 ID 를 부여하지 않는다.
2. **엔티티/타입명 충돌** — 해당 없음. 새 타입 선언 없음. 백엔드 `ResponseExecution` 의
   `Omit<...>` 목록에 `'inputData'` 가 추가되고 필드가 넓혀졌을 뿐, 새 타입/인터페이스 이름은
   생기지 않았다.
3. **API endpoint 충돌** — 해당 없음. 신규 endpoint 없음(기존
   `POST /api/executions/:id/re-run`, `GET /api/executions/:id` 재사용).
4. **이벤트/메시지명 충돌** — 해당 없음. 신규 webhook/queue/SSE 이벤트명 없음. WS
   `execution.node.completed` 의 `input` 필드는 기존 필드의 마스킹 정책만 바뀐 것.
5. **환경변수·설정키 충돌** — 해당 없음.
6. **파일 경로 충돌** — `masked-markers.ts`/`__tests__/masked-markers.test.ts` 는
   `git diff --diff-filter=A` 로 신규 파일임을 재확인했고, 동일 경로에 기존 파일이 없다.
   `lib/utils/` 디렉터리의 기존 kebab-case 명명 컨벤션(`date.ts` 등)과도 어긋나지 않는다.

### 함수/상수명 재사용 — 충돌이 아니라 의도된 미러 / 이동

- `MASKED_MARKERS`/`isMaskedMarker` 는 backend `sanitize-error-message.ts` 의 module-private
  동명 상수·함수(`VALUE_MASK_MARKER='***'` / `KEY_MASK_MARKER='[REDACTED]'` /
  `DEPTH_MASK_MARKER='[REDACTED_DEPTH]'` 로 구성된 집합)를 **의도적으로 이름까지 동일하게**
  복제한 프런트 미러다. 주석에 명시: "미러의 동기화는 결국 사람이 grep 으로 찾는다 — 이름이
  갈리면 그 검색이 실패한다." 두 파일은 서로 다른 빌드 경계(NestJS backend vs Next.js CSR
  frontend)에 있어 이름이 같아도 동일 스코프 내 이중 정의가 아니다 — 실제 충돌 아님. 이
  이름 재사용은 이번 PR 이전(#1181)부터 있던 패턴이고, 이번 PR 은 그 정의를
  `dynamic-form-ui.tsx` 에서 `lib/utils/masked-markers.ts` 로 옮겼을 뿐 새로 만든 것이
  아니다(옛 위치의 정의는 diff 로 삭제 확인).
- `isMaskedMarker`/`hasMaskedMarkerLeaf` 도 동일 — 원래 `dynamic-form-ui.tsx` 안에 로컬
  정의돼 있던 것을 승격(move)한 리팩터이지 재정의가 아니다.

### i18n 키 — 기존 "masked" 계열과 이름 겹침 없음

`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked` 두 키를 도입한다. dict
전체를 `masked`/`Masked`/`MASKED` 로 전수 grep 한 결과 기존 관련 키
(`authentication.keyMasked`, `editor.formMaskedDefaultHint`(#1181 선행 작업),
`integrations.rotateHint`, `nodeConfigs.recordValuesHint`, `triggers.botTokenRegistered`)와
문자열이 정확히 겹치지 않는다. `editor.formMaskedDefaultHint`(기존, 폼 필드 프리필 안내)와
신규 `editor.runWithInputMasked`(JSON 에디터 전체 Run 차단 안내)는 같은 `editor` 네임스페이스에
"masked" 를 공유하지만 키 이름·용도가 모두 다르다 — 자연스러운 이웃 관계.

### 로컬 스코프 헬퍼 — 전수 grep 재확인

`splitMaskedParameters`, `isStructuredType`, `isStructuredField`, `blockedByMaskedInput`,
`touchedMaskedKeys` 를 `rerun-modal.tsx` 밖에서 `git grep` 했으나 동명 식별자가 없다.
export 되지 않는 로컬 정의라 충돌 표면도 없다. 라운드5(`e1607c737`)가 `displayValue`/
`coerceInput`/`isStructuredField` 세 곳에 흩어져 있던 `type === "object" || type === "array"`
술어를 `isStructuredType()` 하나로 통합했는데, 이 이름 역시 다른 파일에 없다.

## 요약

이번 PR 이 도입하는 신규 식별자는 파일 2개(`masked-markers.ts`+테스트)·export 3개
(기존 로컬 정의의 위치 이동)·로컬 헬퍼 소수·i18n 키 2개로 범위가 좁고, 신규 requirement
ID·엔티티·API endpoint·이벤트명·ENV var·config key 는 전혀 도입하지 않는다. 유일하게
"동명"으로 보일 수 있는 `MASKED_MARKERS`/`isMaskedMarker` 의 backend-frontend 페어는 서로
다른 빌드 경계 간 **의도적 미러**(주석으로 명문화)이며 실제 스코프 충돌이 아니다. i18n 키는
전체 dict 대조로도 동명 키가 없음을 확인했다. 오늘 이 변경분에 대해 이미 8회 수행된
naming_collision 검토와 결론이 일치하며, 최신 라운드5 델타(`isStructuredType` 통합 리팩터)에도
새 충돌 표면이 없다.

## 위험도

NONE
