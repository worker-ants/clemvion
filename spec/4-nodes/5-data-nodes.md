# Spec: Data 노드

> 관련 문서: [PRD Data 노드](../../prd/3-node-system.md#7-data-노드-2종) · [Spec 노드 개요](./0-overview.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 노드 샌드박싱](./0-overview.md#5-노드-실행-샌드박싱)

---

## 1. Transform

입력 데이터에 변환 연산(operations)을 순차적으로 적용하여 출력한다. 코딩 없이 시각적 빌더 UI를 통해 데이터를 재구조화할 수 있다.

### 1.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| operations | Operation[] | ✓ | [] | 변환 연산 체인 (순차 적용) |

### 1.2 Operation 정의

각 Operation은 `type`과 해당 타입별 `params`로 구성된다.

| type | params | 설명 |
|------|--------|------|
| `rename_field` | `from` (String), `to` (String) | 필드 이름 변경 |
| `remove_field` | `field` (String) | 필드 제거 |
| `set_field` | `field` (String), `value` (표현식) | 필드 값 설정 (신규 생성 또는 덮어쓰기) |
| `type_convert` | `field` (String), `targetType` (string / number / boolean / array / object) | 타입 변환 |
| `string_op` | `field` (String), `operation` (trim / uppercase / lowercase / replace / split / join), `args` (Object) | 문자열 조작 |
| `math_op` | `field` (String), `operation` (add / subtract / multiply / divide / round / ceil / floor), `operand` (Number, 표현식) | 수학 연산 |
| `date_op` | `field` (String), `operation` (format / add / subtract / diff), `args` (Object) | 날짜 조작 |
| `array_filter` | `field` (String), `condition` (조건 표현식) | 배열 필터링 |
| `array_sort` | `field` (String), `sortBy` (String?), `order` (asc / desc) | 배열 정렬 |
| `object_pick` | `field` (String?), `keys` (String[]) | 객체에서 특정 키만 선택 |

**string_op args:**

| operation | args |
|-----------|------|
| trim | — |
| uppercase | — |
| lowercase | — |
| replace | `search` (String), `replacement` (String), `all` (Boolean) |
| split | `separator` (String) |
| join | `separator` (String) |

**date_op args:**

| operation | args |
|-----------|------|
| format | `pattern` (String, 예: "YYYY-MM-DD HH:mm:ss") |
| add | `amount` (Number), `unit` (years / months / days / hours / minutes / seconds) |
| subtract | `amount` (Number), `unit` |
| diff | `compareField` (String), `unit` |

### 1.3 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | 변환 완료된 데이터 |

### 1.4 실행 로직

1. 입력 데이터를 복제 (원본 불변)
2. `operations` 배열을 순서대로 적용
3. 각 연산은 이전 연산의 결과를 입력으로 받음
4. 최종 결과를 출력 포트로 전달

### 1.5 설정 UI — 시각적 빌더

```
┌──────────────────────────────────────┐
│  Transform Operations                │
│  ────────────────────────────────── │
│  1. [rename_field ▼] from → to       │
│     [user.name___] → [userName___]   │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  2. [set_field ▼]                    │
│     field: [fullName___]             │
│     value: [{{ $input.first + " "... │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  3. [remove_field ▼]                 │
│     field: [tempData___]             │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  [+ Add Operation]                   │
│                                      │
│  ─── Preview ───────────────────── │
│  Input:  { "user": { "name": "Kim" } │
│  Step 1: { "userName": "Kim" }       │
│  Step 2: { "userName": "Kim",        │
│            "fullName": "Kim ..." }   │
│  Step 3: { "userName": "Kim",        │
│            "fullName": "Kim ..." }   │
└──────────────────────────────────────┘
```

- 각 연산을 카드 형태로 표시
- 드래그로 순서 변경 가능 (`[↕]` 핸들)
- 각 카드 삭제 버튼 (`[✕]`)
- `+ Add Operation` 버튼으로 연산 추가
- 하단 Preview: 마지막 실행 데이터 기준으로 각 단계별 결과 미리보기

---

## 2. Code

JavaScript 코드를 작성하여 자유로운 데이터 처리를 수행한다. Transform 노드로 표현하기 어려운 복잡한 로직에 사용한다.

### 2.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| language | Enum | ✓ | javascript | javascript (현재 유일 지원) |
| code | String | ✓ | — | 실행할 코드 |

### 2.2 실행 컨텍스트

코드 내에서 사용 가능한 전역 객체:

| 객체 | 타입 | 설명 |
|------|------|------|
| `$input` | Object | 이전 노드의 출력 데이터 |
| `$vars` | Object | 워크플로우에서 선언된 변수 (읽기/쓰기) |
| `$execution` | Object | 실행 컨텍스트 (`id`, `startedAt`) |
| `$node` | Object | 현재 노드 메타데이터 (`id`, `label`) |

### 2.3 코드 작성 규칙

- `return` 문으로 출력 데이터를 반환해야 함
- `return`이 없으면 출력은 `null`
- 비동기 코드 지원: `async/await` 사용 가능
- 외부 네트워크 접근 불가 (샌드박싱)
- `require`/`import` 불가 (내장 유틸리티만 사용)

### 2.4 내장 유틸리티

| 유틸리티 | 설명 |
|----------|------|
| `$helpers.date(value)` | 날짜 파싱/포매팅 (dayjs 호환) |
| `$helpers.crypto.hash(algorithm, data)` | 해시 생성 (md5, sha256 등) |
| `$helpers.crypto.uuid()` | UUID v4 생성 |
| `$helpers.base64.encode(data)` | Base64 인코딩 |
| `$helpers.base64.decode(data)` | Base64 디코딩 |
| `console.log(...)` | 디버그 로그 (실행 로그에 기록) |

### 2.5 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | return 값 |

### 2.6 실행 로직

1. 입력 데이터를 `$input`에 바인딩
2. 워크플로우 변수를 `$vars`에 바인딩
3. 샌드박스 환경에서 코드 실행
4. `return` 값을 출력 포트로 전달
5. 에러 발생 시 스택 트레이스를 에러 정보에 포함

### 2.7 샌드박싱

노드 실행 샌드박싱 정책(spec/4-nodes/0-overview.md §5)을 동일하게 적용한다.

#### 2.7.1 격리 방식

Code 노드의 JavaScript 실행은 **V8 Isolate (vm2/isolated-vm)** 기반으로 격리한다.

| 방식 | 설명 |
|------|------|
| **Phase 1: V8 Isolate** | `isolated-vm` 라이브러리를 사용하여 별도의 V8 Isolate 내에서 코드를 실행. 메인 프로세스와 메모리 공간이 완전히 분리됨 |
| Phase 2 이후 (선택): Docker 기반 | 대규모 배포 시 컨테이너 격리로 전환 가능. Phase 1에서는 불필요 |

> **선택 근거**: V8 Isolate는 별도 프로세스/컨테이너 오버헤드 없이 수 밀리초 내에 격리 환경을 생성할 수 있다. Code 노드는 데이터 변환 목적이므로 네트워크/파일 접근이 불필요하며, V8 Isolate로 충분한 격리 수준을 제공한다.

#### 2.7.2 리소스 제한

| 항목 | 제한 | 설명 |
|------|------|------|
| 타임아웃 | 기본 30초 (노드 설정에서 1~120초 범위 내 변경 가능) | `isolate.compileScript` + `script.run`에 timeout 옵션 적용 |
| 메모리 | 최대 128MB | `new ivm.Isolate({ memoryLimit: 128 })` |
| 네트워크 | 완전 차단 | `fetch`, `XMLHttpRequest`, `WebSocket` 등 네트워크 API 미주입 |
| 파일 시스템 | 접근 불가 | `fs`, `path`, `child_process` 등 Node.js 모듈 미주입 |
| 모듈 | require/import 불가 | 모듈 로더 미제공. 내장 유틸리티만 전역 객체로 주입 |
| 전역 객체 | 제한된 전역만 허용 | 아래 허용/차단 목록 참조 |

#### 2.7.3 허용/차단 API 목록

**허용 (전역 주입):**

| API | 설명 |
|-----|------|
| `$input`, `$vars`, `$execution`, `$node` | 실행 컨텍스트 객체 (읽기 전용 프록시로 주입) |
| `$helpers` | 내장 유틸리티 (§2.4 참조) |
| `console.log`, `console.warn`, `console.error` | 디버그 로그 (실행 로그에 기록, 최대 100줄) |
| `JSON.parse`, `JSON.stringify` | JSON 처리 |
| `Array`, `Object`, `String`, `Number`, `Boolean`, `Date`, `RegExp`, `Map`, `Set` | 기본 JavaScript 내장 객체 |
| `Math`, `parseInt`, `parseFloat`, `isNaN`, `isFinite` | 수학/파싱 |
| `encodeURIComponent`, `decodeURIComponent` | URI 인코딩 |
| `Promise`, `async/await` | 비동기 처리 (내부 연산용) |
| `setTimeout` (제한적) | 최대 5초, Isolate 타임아웃 내에서만 동작 |

**차단 (주입하지 않음):**

| API | 이유 |
|-----|------|
| `require`, `import` | 외부 모듈 로드 방지 |
| `fetch`, `XMLHttpRequest`, `WebSocket` | 네트워크 접근 차단 |
| `fs`, `path`, `os`, `child_process` 등 Node.js 모듈 | 시스템 접근 차단 |
| `eval`, `Function` 생성자 | 동적 코드 실행 추가 방지 |
| `process`, `global` (Node.js) | 런타임 환경 접근 차단 |
| `Proxy`, `Reflect` (사용자 코드 내) | 샌드박스 탈출 방지 |

#### 2.7.4 에러 처리

| 에러 유형 | 동작 |
|-----------|------|
| 타임아웃 | `EXECUTION_TIMEOUT` 에러 + "Code execution timed out after {n} seconds" |
| 메모리 초과 | `EXECUTION_MEMORY_EXCEEDED` 에러 + "Code exceeded memory limit (128MB)" |
| 런타임 에러 | `CODE_RUNTIME_ERROR` 에러 + 스택 트레이스 (Isolate 내부 라인 번호 매핑) |
| 구문 에러 | `CODE_SYNTAX_ERROR` 에러 + 에러 위치 (line:column) |

#### 2.7.5 `$vars` 쓰기 처리 (Deep Clone + 전체 교체)

`$vars`는 읽기/쓰기 가능하지만, 변경은 Isolate 내부 복제본에서 이루어지며 실행 완료 후 메인 컨텍스트로 **원자적으로** 동기화된다:

1. **실행 전**: `$vars` 데이터를 **deep clone**하여 Isolate로 복사. 원본 실행 컨텍스트의 `$vars`는 변경되지 않음
2. **실행 중**: Isolate 내에서 자유롭게 수정 (중첩 객체 필드 추가/삭제/수정 포함)
3. **실행 후**: Isolate 내의 전체 `$vars` 객체를 메인 실행 컨텍스트의 변수 저장소에 **덮어쓰기(전체 교체)**. 부분 병합이 아닌 전체 교체이므로 코드 내 변경 사항이 원자적으로 반영됨

> **설계 근거**: Proxy 기반 변경 추적 방식 대비 구현이 단순하고, 코드 실행 중 예외 발생 시 원본 `$vars`가 보존되는(롤백) 장점이 있다. 성능 부담은 `$vars` 크기가 통상적으로 작기 때문에 무시할 수 있다.

### 2.8 설정 UI — 코드 에디터

```
┌──────────────────────────────────────┐
│  Code Node                           │
│  Language: [JavaScript ▼]            │
│  ────────────────────────────────── │
│  ┌──────────────────────────────────┐│
│  │ 1│ // 입력 데이터 가공            ││
│  │ 2│ const items = $input.data;     ││
│  │ 3│                                ││
│  │ 4│ const result = items           ││
│  │ 5│   .filter(i => i.active)       ││
│  │ 6│   .map(i => ({                 ││
│  │ 7│     id: i.id,                  ││
│  │ 8│     name: i.name.trim(),       ││
│  │ 9│     score: i.score * 100       ││
│  │10│   }));                         ││
│  │11│                                ││
│  │12│ return { items: result };      ││
│  └──────────────────────────────────┘│
│                                      │
│  ─── Console Output ────────────── │
│  (마지막 실행 시 console.log 출력)   │
│                                      │
│  ─── Result Preview ────────────── │
│  { "items": [ { "id": 1, ... } ] }  │
└──────────────────────────────────────┘
```

- Monaco 스타일 코드 에디터 (구문 강조, 줄 번호, 자동완성)
- `$input`, `$vars`, `$helpers` 자동완성 지원
- 하단 Console Output: 마지막 실행의 `console.log` 출력 표시
- 하단 Result Preview: 마지막 실행의 return 값 JSON 표시
- 에러 발생 시 에디터 내 인라인 에러 표시 + 스택 트레이스

---

## 3. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Transform | `{N} operations` (operations 배열의 길이) | `3 operations` |
| Code | `{language} · {N} lines` (코드 줄 수) | `JavaScript · 12 lines` |
