# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 이번 diff 가 수행 중인 "§ 번호 재동기화" 스윕에서 같은 문단의 형제 인용 하나를 놓쳤다 — 갱신 직후 자기모순 발생
  - 위치: `spec/data-flow/8-notifications.md:192` (실측: 현재 파일 기준 줄 번호)
  - 상세: `spec/5-system/6-websocket-protocol.md` 에 `### 4.3 KB 문서 이벤트` 절이 신설되며 그 뒤 절 번호가 한 칸씩 밀렸다(알림 이벤트 §4.4→§4.5, 시스템 이벤트 §4.5→§4.6, 외부 표면 매핑 §4.6→§4.7). 이 diff 는 `8-notifications.md` 안에서 "알림 이벤트" 절을 가리키는 인용 3곳을 `§4.4`→`§4.5` 로 정확히 갱신했다(파일 22 diff 의 22행·97행·190행, 앵커 프래그먼트 `#44-...`→`#45-...` 포함). 그런데 **바로 두 줄 뒤, 같은 문단·같은 대상 절을 가리키는 네 번째 인용**(`이벤트 이름은 §4.4 기존 notification.new prefix 와 일관성을 유지한다.`)은 갱신되지 않고 남았다. 결과적으로 한 문단 안에서 같은 절을 "§4.5"(190행)라고 불렀다가 "§4.4"(192행)라고 다시 부르는 자기모순이 생겼다 — 실측(`grep -n "이벤트 이름은 §4" spec/data-flow/8-notifications.md` → `192:...§4.4...`)으로 확인. 이 PR 자체가 "하드코딩된 줄 번호/절 번호 인용이 다음 편집에 조용히 무효화된다"는 결함 클래스를 여러 곳(주석 6곳, WS 앵커 96건)에서 잡아내고 고치는 작업인데, 그 작업 스스로가 같은 클래스의 놓친 인스턴스를 새로 남겼다.
  - 제안: `이벤트 이름은 §4.4 기존` → `이벤트 이름은 §4.5 기존` 으로 정정. 부수적으로 `spec-sync-external-interaction-api-gaps.md` 가 이미 지적한 "`spec-links` 가드가 `#fragment` 앵커를 검사하지 않는다"(위치: 같은 PR 의 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"`spec-links` 가드가 앵커를 검사하지 않는다") 문제와 같은 뿌리다. 이 라인의 인용은 앵커가 없는 평문(`§4.4`)이라 그 가드로도 못 잡히므로, 이번 건은 수작업 grep 대조가 유일한 방어선이었고 이번엔 누락됐다.

- **[WARNING]** 매직 넘버 `20` — 파일 자체 컨벤션(모듈 상수 추출)과 불일치
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `_scope_delta_census` 함수, `scope_hits[:20]` / `len(scope_hits) - 20` (신규 추가된 두 지점)
  - 상세: "표시할 최대 파일 목록 수 = 20" 이 함수 본문에 리터럴로 두 번 박혀 있다. 같은 파일은 이미 이런 종류의 임계값·패턴을 모듈 최상단 이름 있는 상수로 뽑아내는 확립된 관례를 갖고 있다(`OMITTED_FILES_HEADING`, `CONSISTENCY_MAX_CONTEXT_SIZE`(환경변수 기본값 `262144`), `_CATALOG_BULK_RE`, `_NAME_START`/`_NAME_END` 등). 이 신규 함수만 그 관례를 따르지 않아 파일 내 일관성(점검 관점 8)이 깨진다. 리터럴이 두 곳(슬라이스 상한·"외 N건" 계산)에 중복돼 있어 나중에 하나만 고치는 drift 위험도 있다.
  - 제안: 모듈 레벨에 `_SCOPE_HITS_DISPLAY_LIMIT = 20` 같은 이름을 두고 두 지점에서 참조.

- **[INFO]** 새 함수 삽입부에 파일의 기존 2-blank-line 관례를 벗어난 3-blank-line 이 생겼다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` — `_head_basis_notice` 종료(`)` 로 끝나는 줄)와 `_count_diff_files` 정의 사이(실측: 현재 파일 477~479행이 연속 3줄 공백, 480행이 `def _count_diff_files`)
  - 상세: 이 파일의 나머지 모든 top-level 함수 경계는 PEP8 관례대로 빈 줄 2개다(`_splice_chunk`→`format_file_bundle`, `format_file_bundle`→`_collect_code_diff`, `_collect_code_diff`→`_head_basis_notice`, `_count_diff_files`→`_scope_delta_census`, `_scope_delta_census`→`RATIONALE_HEADER_RE` 모두 2줄로 실측 확인). 이번 diff 가 삽입한 딱 한 지점만 3줄이라 일관성이 깨진다. 동작에는 영향 없는 순수 스타일 이슈.
  - 제안: 빈 줄 1개 제거.

- **[INFO]** `_scope_delta_census` 가 "scope 델타 계산+포맷" 과 "diff 델타 계산+포맷" 두 책임을 한 함수에 담고 있다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 함수 `_scope_delta_census` 전체(신규 추가)
  - 상세: 함수가 (1) scope 매칭 파일 목록 산출, (2) scope 라인 마크다운 포맷(2개 분기), (3) diff 파일/줄 수 계산, (4) diff 라인 마크다운 포맷(2개 분기), (5) 최종 조립 — 다섯 단계를 순차로 수행한다. 분기 자체는 얕고(if/else 2쌍, 중첩 없음) 순환복잡도는 낮지만, "scope 축"과 "diff 축"은 서로 독립적인 두 관심사라 `_format_scope_delta_line(...)`/`_format_diff_delta_line(...)` 로 쪼개면 각각을 격리 테스트하거나 재사용하기 쉬워진다. 다만 이 파일은 `_head_basis_notice` 처럼 하나의 큰 서술형 마크다운 블록을 만드는 함수를 이미 여러 개 갖고 있어(파일의 기존 스타일과 일치), 이 정도 길이(~35줄 로직 + ~20줄 docstring)를 분리 안 한 것 자체가 이례적이진 않다. 심각도는 낮게 잡는다.
  - 제안: 필수는 아니나, 향후 세 번째 "축"(예: rationale 델타 등)이 추가될 경우를 대비해 두 헬퍼로 미리 쪼개 두는 편이 확장에 유리하다.

## 검증 메모

저장소 뮤테이션 없이 `Read`/`Grep`/`git diff` 로만 검증했다. 위 4건 모두 실제 저장소 파일을 열어 직접 확인했으며(라인 번호는 소스 파일의 실제 줄 번호), `git status --short` 로 작업 트리 변경 없음을 확인했다.

새로 추가된 테스트 파일들(`.claude/tests/test_consistency_scope_census.py`, `codebase/backend/.../workflow-assistant.controller.swagger.spec.ts`)은 저장소의 기존 테스트 관례(`_harness.run_in_orchestrator` 패턴, `swagger-probe` 공용 헬퍼 재사용, "공허 방지"용 전제 단언)를 그대로 따르고 있어 일관성 위반이 없다. `chat-channel.dispatcher.ts`/`.spec.ts`/`types.ts` 의 변경은 하드코딩된 줄 번호 인용(`line 536`, `line 89`)을 제거하는 순수 주석 정정으로, 향후 편집이 그 인용을 조용히 무효화시키는 위험을 줄이는 긍정적 변경이다. `workflow-assistant.controller.ts` 의 `@ApiUnauthorizedResponse` 추가는 저장소 전역에 156회 쓰인 정본 문구를 그대로 재사용해 7개 라우트에 동형으로 적용했고 형제 데코레이터(`@ApiForbiddenResponse`) 바로 앞이라는 기존 배치 관례도 지켰다.

## 요약

핵심 코드 변경(`consistency_orchestrator.py` 의 신규 헬퍼 2개, 대응 테스트 스위트, TS 주석 정정, swagger 데코레이터 추가 + 회귀 테스트)은 전반적으로 가독성이 높고 저장소의 기존 컨벤션(모듈 상수 추출, docstring 에 root-cause 서술, `_harness` 기반 테스트 하네스, swagger 문구 재사용)을 잘 따른다. 함수 길이·중첩 깊이·순환 복잡도 모두 문제 수준이 아니며 중복 코드도 없다. 다만 신규 `_scope_delta_census` 에 이 파일 고유의 "매직넘버는 이름 있는 상수로" 관례를 벗어난 리터럴 `20` 이 있고, 바로 옆에 스타일 상 빈 줄 하나가 더 들어갔다. 더 눈에 띄는 것은 마크다운 spec 문서 쪽인데, 이 PR 이 정확히 "썩은 절 번호 인용"을 스윕해서 고치는 작업임에도 그 스윕이 `8-notifications.md` 안의 형제 인용 하나를 놓쳐, 같은 문단 안에서 새 절 번호(§4.5)와 옛 절 번호(§4.4)가 두 줄 간격으로 공존하는 자기모순을 새로 만들었다. 코드 결함이라기보다 문서 유지보수성 결함이지만, 이 PR 의 목적 자체가 그 결함 클래스를 근절하는 것이라는 점에서 지나치기 아까운 재발이다.

## 위험도

LOW
