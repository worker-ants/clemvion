# 성능(Performance) 리뷰 결과

## 발견사항

### 발견사항 없음 (중요 이슈)

모든 변경 파일을 성능 8개 관점에서 검토한 결과, 아래 항목별 평가를 도출했다.

---

### [INFO] dispatcher.ts — IIFE 를 통한 조건부 spread (알고리즘 복잡도)

- 위치: `chat-channel.dispatcher.ts` lines 311–314 (diff 내 신규 코드)
- 상세:
  ```ts
  ...(() => {
    const title = extractFormTitle(modalFormConfig);
    return title ? { title } : {};
  })(),
  ```
  매 이벤트 처리 시 IIFE + 빈 객체 생성 + spread 가 발생한다. `modalMsg` 가 존재하는 경우에만 진입하므로 실행 빈도는 낮지만, 동일한 목적을 단순 조건 대입으로 달성할 수 있다.
  ```ts
  const title = extractFormTitle(modalFormConfig);
  if (title) state.pendingFormModal.title = title;
  ```
  할당 횟수·임시 객체 생성·스프레드 비용을 제거할 수 있다. 단, 현재 트래픽 규모에서 실측 영향은 무시 가능하다.
- 제안: IIFE spread 패턴 제거 후 직접 프로퍼티 대입으로 교체 (가독성 + 미미한 GC 압력 감소).

---

### [INFO] discord.adapter.ts openFormModal — 매 호출 시 fields.map 에서 다수 spread 누적 (메모리 할당)

- 위치: `discord.adapter.ts` `openFormModal`, lines ~1917–1940
- 상세:
  ```ts
  components: params.fields
    .slice(0, NATIVE_MODAL_MAX_FIELDS)
    .map((f) => ({
      type: 1,
      components: [
        {
          ...
          ...(typeof f.minLength === 'number' && f.minLength >= 0
            ? { min_length: Math.min(f.minLength, 4000) }
            : {}),
          ...(typeof f.maxLength === 'number' && f.maxLength >= 1
            ? { max_length: Math.min(f.maxLength, 4000) }
            : {}),
          ...(f.description
            ? { placeholder: f.description.slice(0, 100) }
            : {}),
        },
      ],
    })),
  ```
  필드당 최대 3개의 임시 빈 객체 (`{}`) 가 생성·spread 된다. Discord modal 최대 필드 수가 5개(`NATIVE_MODAL_MAX_FIELDS`)로 고정돼 있어 GC 압력은 매우 낮다. 그러나 조건부 spread 대신 직접 프로퍼티 대입 패턴이 더 명확하다.
- 제안: 허용 가능 수준의 INFO. 필드 수가 최대 5개이므로 실제 성능 영향 없음. 코드 스타일 수준의 개선 사항으로만 기록.

---

### [INFO] validateFormSubmission — select/radio options.map 반복 (알고리즘 복잡도)

- 위치: `form-mode.ts` `validateFormSubmission`, 기존 코드
- 상세:
  ```ts
  const allowed = def.options.map((o) => o.value);
  if (!allowed.includes(value)) { ... }
  ```
  필드 검증마다 `options` 전체를 배열로 새로 생성 후 선형 탐색한다. form 옵션 수가 소규모(통상 수 개~수십 개)이고, 본 변경 PR 에 포함된 신규 코드가 아닌 기존 로직이다. 이번 diff 에서 변경된 코드는 아니며 참고 목적으로만 기재.
- 제안: 본 PR 범위 밖. 필요 시 `Set<string>` 으로 교체하면 O(n) → O(1) lookup 가능하지만, 실제 옵션 수가 매우 적어 성능 영향은 없다.

---

### [INFO] extractFormTitle — title.trim() 이중 평가 가능성 없음 (확인)

- 위치: `form-mode.ts` `extractFormTitle`
- 상세: 신규 추가된 `extractFormTitle` 함수는 `title.trim().length > 0` 한 번만 호출한다. trim 결과를 반환하지 않고 원본 `title` 을 반환하므로, 호출자(dispatcher)에서 별도 trim 이 필요한 경우가 있으나 모달 제목은 양 끝 공백 포함 사용이 spec 의도에 부합하므로 이슈 없음.
- 제안: 없음.

---

## 요약

이번 변경(§3.1 `botIdentity.publicKey` 캐시, §3.3 modal title 동적화 + TEXT_INPUT 길이 제약, §5.1(b) reply 버튼 확인)은 성능 측면에서 위험 요소가 없다. 신규 코드는 모두 이벤트 핸들러 내 일회성 경량 연산으로 구성되어 있으며, 반복문 내 외부 호출(N+1), 대규모 메모리 할당, 블로킹 I/O, 캐싱 미흡, 비효율 자료구조 등의 문제는 존재하지 않는다. dispatcher 의 IIFE spread 패턴과 `openFormModal` 내 다중 조건 spread 는 INFO 수준의 스타일 개선 여지가 있으나 Discord modal 최대 필드 수(5개) 제한과 이벤트 발생 빈도를 고려하면 실측 영향은 무시 가능하다.

## 위험도

NONE
