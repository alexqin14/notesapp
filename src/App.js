import logo from './logo.svg';
import './App.css';

import React, {
  useEffect
  , useReducer
} from 'react';
import { API } from 'aws-amplify';
// import { List } from 'antd';
import 'antd/dist/antd.css';
import { listNotes } from './graphql/queries';

import { v4 as uuid } from 'uuid'
import { List, Input, Button } from 'antd'

import { 
  updateNote as UpdateNote
  , createNote as CreateNote 
  , deleteNote as DeleteNote
} from './graphql/mutations'

import { 
  onCreateNote 
} from './graphql/subscriptions'

const CLIENT_ID = uuid();

const initialState = {
  notes: [],
  loading: true,
  error: false,
  form: { name: '', description: '' }
}
const reducer =(state, action) =>{
  switch(action.type) {
    case 'SET_NOTES':
     return { ...state
      , notes: action.notes
      , loading: false }
      
    case 'ERROR':
      return { ...state
        , loading: true
        , error: true };
  
    case 'ADD_NOTE':
        return {
          ...state
          , notes: [
            ...state.notes
            ,action.note
          ]
        }


    case 'RESET_FORM':
      return {
        ...state
        , form: initialState.form
      }

  
      
    case 'SET_INPUT':
      return {
        ...state
        , form: {
          ...state.form
          , [action.name]: action.value
        }
      }

    
          
      default:
      return {
      ...state
    } 
    
  }
}
const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchNotes = async() => {
    try {
      const notesData = await API.graphql({
        query: listNotes
      });
      dispatch({ 
        type: 'SET_NOTES'
        , notes: notesData.data.listNotes.items 
       // , notes: notesData.data.listNotes.items.sort((a, b) => a.name > b.name ? 1 : -1) 
       //sort notes wehn first read from the backend 
      });
    } 
    
    catch (err) {
      console.error(err);
      //console.log('error: ', err)
      dispatch({ 
        type: 'ERROR' 
      });
    }

  };

  useEffect(
    //lamda  goes to fetchNotes funtion
    () => {
    fetchNotes();
    const subscription = API.graphql(
      {
      query: onCreateNote
      }
    ).subscribe(
      {
      next: noteData => {
        // get the note from the subscription payload
        console.log(noteData)
        const note = noteData.value.data.onCreateNote

        // bail if this instance of the app cause this sbuscription
        if (CLIENT_ID === note.clientId) {
          return;
        }

        // otherwise, update the state with the new note
        dispatch({ type: 'ADD_NOTE'
        , note 
      })
      }
    })
    return () => subscription.unsubscribe()
    }
    , []
  )
  
  const styles = {
    container: {
      padding: 20
    }
    , input: {
      marginBottom: 10
    }, item: { 
      textAlign: 'left' 
    }, p: { 
      color: '#1890ff' 
    }
  };

const createNote = async () => {
  // destructuring... form
  const { form } = state;
  //lame form validation, but good enough
  if (!form.name || !form.description) {
      return alert('please enter a name and description')
  }

  const note = { 
    ...form
    , clientId: CLIENT_ID
    , completed: false
    , id: uuid() 
  };
  // optimistic dispatch, updates local app state before calling GraphQL mutation endpoint

  dispatch({ 
    type: 'ADD_NOTE'
    // shorthand synatx for note: note
    , note 
  });
  dispatch({ 
    type: 'RESET_FORM' 
  })

  try {
    await API.graphql({
      query: CreateNote
      , variables: { 
        input: note 
      }
    });

    console.log('successfully created note!')

  } catch (err) {
    console.log("error: ", err);
  }
};

const onChange = (e) =>{
  dispatch({ 
    type: 'SET_INPUT'
    , name: e.target.name
    , value: e.target.value 
  })

}
const deleteNote = async (noteToDelete) => {
  // optimistically update the state with the note removed
  dispatch({ 
    type: 'SET_NOTES'
    , notes: state.notes.filter(x => x != noteToDelete)
    //[...state.notes.filter(x => x != noteToDelete)
    //] 
  });
  // call the backend to delete
  try {
    await API.graphql({
      query: DeleteNote,
      variables: { 
        input: {
          id: noteToDelete.id
        }
       }
    })
    //console.log('successfully deleted note!')
  } catch (err) {
    console.error(err)
  }

}
  const updateNote = async (noteToUpdate) => {
    // update state first
    dispatch({
      type: "SET_NOTES"
      , notes: state.notes.map(x => ({
        ...x
        , completed: x == noteToUpdate ? ! x.completed : x.completed
      }))
    });
    // Then call backend

    try {
      await API.graphql({
        query: UpdateNote,
        variables: { 
          input: { 
            id: noteToUpdate.id
            , completed: !noteToUpdate.completed 
          } }
      });
    } catch (err) {
      console.error(err);
    }
  }
  const renderItem = (item) => {
    return (
      <List.Item
        style={styles.item}
        actions={[
          <p
            style={styles.p}
            onClick={() => deleteNote(item)}
          >
            Delete
          </p>
          , <p
              style={styles.p}
              onClick={() => updateNote(item)}
          >
            { item.completed ? 'Mark Incomplete' : 'Mark Complete'}
          </p>
        ]}
      >
        <List.Item.Meta 
          title={`${item.name}${item.completed ? ' (completed)' : ''}`}
          description={item.description}
        />
      </List.Item>
    );
  };
  return (
    <div 
      style={styles.container}
    >
    <Input
      onChange={onChange}
      value={state.form.name}
      placeholder="Enter Note Name"
      name='name'
      style={styles.input}
    />
    <Input
      onChange={onChange}
      value={state.form.description}
      placeholder="Enter description"
      name='description'
      style={styles.input}
    />
    <Button
      onClick={createNote}
      type="primary"
    >
      Create Note</Button>
    <List
    loading={state.loading}
    dataSource={state.notes}
    renderItem={renderItem}
    />
  </div>
  );
}

export default App;
