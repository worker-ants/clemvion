# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 3: backend-labels.test.ts

- **[INFO]** `LOCALIZED_ERROR_CODES` 배열이 정적 리터럴 목록으로 하드코딩되어 있고, `ERROR_KO` 테이블과 동기화가 수동으로만 유지된다.
  - 위치: `backend-labels.test.ts` L993–L1006, `describe("i18n Principle 3-C …")`
  - 상세: 새 에러 코드를 `ERROR_KO`에 추가할 때 `LOCALIZED_ERROR_CODES`도 수동으로 갱신해야 한다. 추가는 가드로 강제하지만, 제거(stale entry) 는 강제하지 않는다. P3-C-2는 "등록 코드 전부가 `ERROR_KO`에 있는지"만 검증하므로, `ERROR_KO`에서 코드를 삭제해도 `LOCALIZED_ERROR_CODES`가 업데이트되지 않으면 가드가 실패한다. 반대로 `LOCALIZED_ERROR_CODES`에서만 삭제하면 조용히 통과한다. 이는 기존 패턴의 의도된 한계이므로 블로커는 아니나, 해당 코멘트가 이미 inline 설명으로 적혀 있으므로 팔로우업 후보로만 기록.
  - 제안: `LOCALIZED_ERROR_CODES`를 `Object.keys(ERROR_KO)` 의 서브셋으로 도출하거나, `ERROR_KO` 전체 키를 대상으로 parity를 검사하는 방향으로 장기 개선 고려.

- **[INFO]** `NESTED_DEPTH_RULE_ID`, `CONCURRENCY_CAP_RULE_ID` 상수가 `describe` 블록 안에서만 선언되어 `translateGraphWarning` 테스트 간 중복 없이 잘 추출되어 있다. 패턴은 일관되고 양호하다.

### 파일 4: backend-labels.ts

- **[INFO]** `ERROR_KO` 내의 chat-channel 에러 코드 5종 추가가 기존 코드 블록 바로 아래, 섹션 주석과 함께 삽입되었다. 파일 내 기존 패턴(코드 그룹마다 인라인 주석 + spec 참조)을 충실히 따르고 있어 일관성 측면에서 양호하다. 단, `TRIGGER_NOT_FOUND`의 번역 "해당 웹훅 엔드포인트를 찾을 수 없어요."는 에러 코드명이 트리거 레벨인 반면 번역은 "웹훅 엔드포인트"로 구체화하여, 미래에 트리거가 웹훅 이외 경로로도 쓰인다면 번역이 오해를 줄 수 있다.
  - 위치: `backend-labels.ts` L1780–L1781
  - 상세: `TRIGGER_NOT_FOUND` 에러는 채팅 채널 어댑터에서만 발생하지만 코드명 자체는 트리거 전체 개념. 현 사용 범위(chat-channel 경로)에서는 문제없으나, 코드 재사용 시 번역이 부정확해질 가능성.
  - 제안: "해당 트리거를 찾을 수 없어요." 처럼 더 중립적인 표현 사용 또는 주석으로 사용 범위 명시.

### 파일 6: _generator.py

- **[INFO]** `clean`, `oneline`, `oneline_multi`, `mdcell` 함수가 한 줄 또는 두 줄로 정의되어 있으며 줄 바꿈 없이 연속 작성되어 있다 (L2150–L2160). 가독성이 다소 떨어진다.
  - 위치: `_generator.py` L2150–L2160
  - 상세: 스크립트 전체적으로 밀도 높은 코딩 스타일이 일관되게 유지되고 있어 기존 패턴을 이탈한 것은 아니나, 유지보수자가 처음 접근할 때 파악하기 어렵다.
  - 제안: 이 파일은 생성기 스크립트로 핵심 로직이 한 파일에 집중되어 있어 분리 부담이 크지 않다면 최소한 섹션별 빈 줄 구분 정도는 권장.

- **[INFO]** 이번 변경(L2005–L2006 `kind not in ('obj', 'arr')` 조건 추가)은 작고 명확하며 인라인 주석도 충분하다. 변경 이유가 한국어로 잘 설명되어 있어 의도 파악에 문제 없다.

- **[INFO]** `main()` 함수(L2464–L2502)는 약 40줄 내외로 단일 진입점 역할을 충실히 수행하며, arg 파싱과 실행 루프를 함께 담고 있다. 현재 파일 규모에서는 허용 범위 안이다.

### 파일 1, 5, 7 (Markdown / MDX / 계획 문서)

- **[INFO]** `plan/complete/fix-spec-frontmatter-catalog.md`의 `spec_impact` frontmatter 키 추가는 plan 파일 스키마에 새 필드를 도입한다. 기존 계획 파일들이 이 필드를 일관되게 갖는지 여부는 이 변경으로는 확인되지 않는다. 선택적(optional) 필드라면 무방하나, 필수 필드로 간주되면 기존 파일들이 불일치 상태가 된다.
  - 위치: `fix-spec-frontmatter-catalog.md` frontmatter, L86–L88
  - 제안: `spec_impact` 필드의 필수/선택 여부를 plan 스키마 문서에 명시하거나, 이번 PR로 추가했다면 CLAUDE.md / plan-lifecycle.md에 선택 필드임을 기록.

- **[INFO]** `triggers.mdx`의 error code callout 문구 변경("일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요." → "한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요.")은 이번 i18n 구현 완료에 맞춰 문서를 현실과 일치시킨 적절한 수정이다.

- **[INFO]** `plan/in-progress/spec-sync-chat-channel-gaps.md`의 `worktree: (unstarted)` 값은 의미상 명확하지만 비표준 값이다. worktree 필드가 실제 worktree 디렉토리명을 가리키는 용도라면 `(unstarted)` 를 쓰는 대신 빈 값(`worktree: ""`) 또는 필드 자체를 생략하거나 `null` 로 표기하는 것이 더 기계 파싱에 친화적이다.
  - 위치: `spec-sync-chat-channel-gaps.md` L2, frontmatter
  - 제안: plan-lifecycle 스키마에서 미착수 상태 표기 방식을 정의하고 일관되게 사용.

## 요약

이번 변경은 chat-channel 에러 코드 5종의 i18n 매핑 추가, 관련 테스트 갱신, 문서 현행화, 그리고 `_generator.py`의 컨테이너 필드 cross-map 버그 수정으로 구성된다. 핵심 TypeScript 코드(`backend-labels.ts`, `backend-labels.test.ts`)는 기존 파일의 네이밍·그룹핑·주석 패턴을 충실히 따르고 있어 일관성이 높다. Python 생성기 변경은 단일 조건문 추가로 범위가 좁고 설명이 충분하다. 발견된 항목은 모두 INFO 등급이며 구조적·가독성 위험 요소는 없다.

## 위험도

NONE
