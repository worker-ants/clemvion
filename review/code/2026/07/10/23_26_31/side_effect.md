### 발견사항

- **[INFO]** `output` envelope 에 렌더 미소비 필드(`itemsTruncated`/`itemsTotalCount`)가 부수적으로 섞여 들어감
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:144-155` (`asEnvelope`), `toCarousel`(187-203)/`toChart`(236-258)/`toTemplate`(265-280)
  - 상세: `truncationMeta()`는 `truncation` 객체에 있는 4개 키(`rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount`)를 종류 구분 없이 전부 `output`에 흡수한다. `toTable`만 `rowsTruncated`를 소비하고, `toCarousel`/`toChart`/`toTemplate`는 이 키들을 전혀 읽지 않으므로 현재는 무해한 "죽은 필드"로 남는다 — 실질적 부작용은 없다. 다만 향후 카루셀 잘림 배너(`CarouselData.truncated`, RESOLUTION.md에 미구현으로 명시된 후속 항목)가 추가되면 `output.itemsTruncated`가 이미 이 경로로 유입되고 있었다는 사실을 놓치기 쉽다.
  - 제안: 조치 불요(현재 무해). 카루셀 배너 구현 시 `toCarousel`이 `output.itemsTruncated`를 실제로 소비하기 시작하는 지점에서 이 merge 로직이 이미 준비돼 있음을 인지하면 충분.

- **[INFO]** `asEnvelope`/`truncationMeta`/`TRUNCATION_KEYS`는 모듈 비공개(non-export) — 공개 인터페이스 변경 없음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:110-125, 144-155`
  - 상세: `grep` 결과 `asEnvelope`/`toTable`/`toCarousel`/`toChart`/`toTemplate`/`classifyPresentation`의 유일한 프로덕션 소비처는 `src/widget/components/presentations.tsx`뿐이며, 그 파일은 이번 diff에 포함되지 않았다(`truncated` 필드를 이미 읽던 기존 코드 그대로). 기존 export 함수들의 시그니처(인자/반환 타입)는 변경되지 않았고, 새로 추가된 두 헬퍼(`truncationMeta`, 상수 `TRUNCATION_KEYS`)는 export 되지 않아 외부 호출자에 영향이 없다.
  - 제안: 조치 불요 — 확인성 기록.

- **[INFO]** 순수 함수 유지 — 공유/전역 상태 변경 없음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:117-125, 144-155`
  - 상세: `truncationMeta`는 인자로 받은 값을 읽기만 하고 매 호출마다 새 객체(`meta`)를 생성해 반환한다. `asEnvelope`도 `{ ...payload }`/`{ ...payload, ...truncationMeta(...) }`로 매번 새 객체를 만들어 `config`/`output`의 aliasing을 끊는 기존 설계를 유지한다(JSDoc에도 명시). 모듈 스코프에 추가된 `TRUNCATION_KEYS`는 `readonly` 튜플로 취급되는 `as const` 배열이며 어디서도 mutate 되지 않는다. 파일시스템·네트워크·환경변수 접근, 이벤트/콜백 발생도 이 diff에 없다.
  - 제안: 조치 불요 — 확인성 기록.

- **[INFO]** 테스트 전용 변경(파일 1·2·4)은 프로덕션 부작용 없음
  - 위치: `codebase/channel-web-chat/src/lib/conversation.test.ts`, `presentation.test.ts`, `src/widget/components/presentations.test.tsx`
  - 상세: 신규 테스트는 기존 export 함수(`threadToMessages`, `classifyPresentation`, `toCarousel`/`toTable`/`toChart`/`toTemplate`, `PresentationList`)를 순수 입력→출력 검증으로만 호출한다. 전역 mock 설치, 모듈 레벨 spy, 타이머/네트워크 stub 등 테스트 간 상태 누수를 일으킬 수 있는 패턴은 없다.
  - 제안: 조치 불요 — 확인성 기록.

- **[INFO]** `review/` 산출물(파일 6~10 등) 및 `plan/` 갱신은 코드 실행 경로와 무관한 부수 아티팩트
  - 위치: `review/code/2026/07/10/23_04_23/*`, `plan/in-progress/widget-presentation-restore.md`
  - 상세: 이전 리뷰 라운드(23_04_23)의 SUMMARY/RESOLUTION/개별 리뷰어 산출물 신규 생성과 plan 문서 진행상황 갱신으로, 런타임 코드에 영향을 주는 파일시스템 부작용이 아니라 프로젝트 컨벤션상 의도된 문서 산출물이다.
  - 제안: 조치 불요 — 확인성 기록.

### 요약

이번 diff의 실질 프로덕션 코드 변경은 `codebase/channel-web-chat/src/lib/presentation.ts`의 `asEnvelope` 내부 병합 로직 한 곳(신규 비공개 헬퍼 `truncationMeta` + 상수 `TRUNCATION_KEYS` 추가)뿐이며, 이는 명시적 4-키 화이트리스트로 범위가 봉인된 순수 함수라 전역/공유 상태 변경, 파일시스템·네트워크·환경변수 접근, 이벤트/콜백 발생이 전혀 없다. 변경된 함수들은 모두 비공개(non-export)이거나 기존 시그니처를 그대로 유지하며, 유일한 소비처(`presentations.tsx`)가 이번 diff에 포함되지 않았음을 확인해 호출자 영향도 없다. 유일하게 주목할 점은 `output` merge 가 현재 미소비 필드(`itemsTruncated`/`itemsTotalCount`)까지 부수적으로 흡수한다는 것이나 이는 무해한 죽은 필드로, 후속 카루셀 배너 구현 시 참고할 정보성 사안일 뿐 차단 사유가 아니다.

### 위험도
NONE
