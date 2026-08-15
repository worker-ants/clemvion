# 정식 규약 준수 검토 — spec/5-system/14-external-interaction-api.md

## 검토 범위 및 방법

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `_prompts/convention_compliance.md` 자체는 컨텍스트 예산 초과로 `spec/conventions/**` 271개
  파일 전체와 `<git diff origin/main...HEAD -- code_areas>` 를 포함한 17개 파일 본문을 생략하고
  있었다. 프롬프트만으로는 실제 diff 조차 확인할 수 없었으므로, 이번 검토는 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, 현재 CWD 와 동일)에서
  `git diff origin/main...HEAD -- spec/5-system/` 를 직접 실행해 실제 변경분을 확보하고,
  관련 규약 원문(`swagger.md`·`redis-keys.md`·`error-codes.md`·`audit-actions.md`·
  `2-api-convention.md §5.4`)을 `Read` 로 직접 열어 대조했다. 코드 측 구현(`terminal-duration.ts`,
  `execution-engine.service.ts`, `retry-turn.service.ts`, `execution-response.dto.ts`)도 절대경로로
  직접 확인했다.
- 실제 diff 는 `spec/5-system/14-external-interaction-api.md` 1개 파일, 18줄 추가/8줄 삭제뿐이다
  (§6 종결 이벤트 `durationMs` 구현 반영 + §12 Re-run API 경로 `/v1/` 세그먼트 오기 정정). 이전
  라운드(`review/consistency/2026/08/15/08_45_50`, `09_00_27`)에서 이미 CRITICAL 로 지적됐던
  `/api/v1/executions/:id/re-run` → `/api/executions/:id/re-run` 정정이 이번 diff 에 반영되어
  §1 "버전은 URL 경로에 포함하지 않음" 규약과 `13-replay-rerun.md` SoT 표기에 정합됐음을 코드
  (`executions.controller.ts` `@Controller('executions')` + `@Post(':id/re-run')`)로도 재확인했다 —
  더 이상 위반이 아니다.

## 발견사항

- **[WARNING] `durationMs` 반영 JSON 예시 2곳에 콤마 누락 — 구문상 파싱 불가**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.3 (`execution.completed` 예시,
    현재 파일 756번째 줄 부근) · §6.4 (`execution.failed` 예시, 776번째 줄 부근)
  - 위반 규약: 두 섹션 모두 §6 도입부가 "이 절이 outbound 이벤트 계약의 **SoT**" 라고 선언하는
    normative 절이며, [`2-api-convention.md §5`](../5-system/2-api-convention.md) 응답/페이로드
    문서화 관행("아래 JSON 블록이 실제 wire 를 나타낸다")과 같은 층의 문서 정밀성 기준을 어긴다.
    같은 파일 §6.2 는 스스로 "위 JSON 은 논리 구조 표기다 — 실제 wire 필드명은 아래가 SoT" 라는
    비-literal 면책 각주를 명시적으로 다는데, §6.3/§6.4 에는 그런 면책이 없어 **literal 예시로
    읽히도록 의도**되어 있다.
  - 상세: 이번 diff 가 `durationMs` 필드를 예시 JSON 에 추가하면서 콤마를 빠뜨렸다.
    - §6.3: `"status": "completed"` 다음 줄에 `"durationMs": 4242,` 를 삽입했는데
      `"status": "completed"` 뒤에 콤마가 없다 (`"status": "completed"\n    "durationMs": 4242,`).
      diff 전에는 그 자리가 주석(`// result.outputs / durationMs — Planned`)뿐이라 유효한
      JSONC 였으나, 실제 프로퍼티로 바뀌면서 무효가 됐다.
    - §6.4: `error` 객체를 닫는 `}` 바로 다음에 `"durationMs": 4242,` 를 삽입했는데 `}` 뒤에
      콤마가 없다 (`    }\n    "durationMs": 4242,`). diff 전에는 그 자리가 주석
      (`// durationMs — Planned`)이라 유효했으나 마찬가지로 무효가 됐다.
    - 두 블록 모두 그대로 JSON.parse/JSON5 파서에 넣으면 실패한다 — normative 예시를 그대로
      복붙해 webhook 수신 fixture 를 만드는 외부 연동 개발자에게 오해를 유발할 수 있다.
  - 제안:
    - §6.3: `"status": "completed"` → `"status": "completed",`
    - §6.4: `error` 객체를 닫는 `    }` → `    },`

- **[INFO] `durationMs` 의 `null` 부재 표현은 §5.4 규약과 정합**
  - target 위치: §6 필드 집합 표 `durationMs` 행, §6.5 `durationMs` 콜아웃
  - 대조 규약: [`2-api-convention.md §5.4`](../5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략)
    "기본은 `null`"
  - 상세: target 은 "밀리초. **알 수 없으면 `null`** (형제 `error.code` 와 같은 부재 표현)" 으로
    적어 §5.4 의 기본 선택(`null`, 상시 존재 키)과 기존 선례(형제 필드 인용 방식)를 그대로
    따른다. 코드(`resolveTerminalDurationMs` — 계산 불가 시 `null` 반환, `undefined` 는 절대
    반환하지 않음; `emitCancellationEvent` 의 `durationMs: opts.durationMs ?? null`)도 이
    규약대로 구현되어 spec-코드 정합도 확인했다.
  - 제안: 조치 불필요 — 기록 목적.

- **[INFO] Re-run API 경로 정정이 이전 CRITICAL 을 해소**
  - target 위치: §12 호환성
  - 대조 규약: [`2-api-convention.md §1`](../5-system/2-api-convention.md#1-기본-원칙) "버전은 URL
    경로에 포함하지 않음"
  - 상세: 이전 라운드(`08_45_50`)가 지적한 `POST /api/v1/executions/:id/re-run` (금지된 `/v1/`
    세그먼트)가 이번 diff 에서 `POST /api/executions/:id/re-run` 으로 정정됐다. 실제 컨트롤러
    (`executions.controller.ts:56` `@Controller('executions')` + `:258` `@Post(':id/re-run')`)와도
    일치한다.
  - 제안: 조치 불필요 — 기록 목적.

## 요약

이번 diff(`origin/main` 대비 `spec/5-system/14-external-interaction-api.md` 26줄)는 EIA 종결
이벤트(`completed`/`failed`/`cancelled`) `durationMs` 필드 구현을 spec 에 반영하고, 이전 라운드가
지적한 Re-run API `/v1/` 경로 오기를 정정한 소규모 변경이다. `null` 부재 표현·명명(`durationMs`)
모두 `2-api-convention.md §5.4`·기존 선례와 정합하며 코드(`terminal-duration.ts` 등)와도 일치를
직접 확인했다. 다만 §6.3·§6.4 의 정규(normative) 예시 JSON 두 곳에서 `durationMs` 필드를 삽입하며
콤마를 빠뜨려 구문상 파싱되지 않는 상태로 남았다 — CRITICAL 급 규약 위반은 아니지만, 이 절이
"outbound 이벤트 계약의 SoT" 라고 스스로 선언하는 만큼 정정이 필요한 WARNING 이다.

## 위험도

LOW
